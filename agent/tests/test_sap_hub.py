"""SAP Business Accelerator Hub sandbox adapter and the get_sap_quality_context tool. All HTTP is mocked."""

import json

import httpx
import pytest

from quality_agent.engines import MockEngine, Proposal
from quality_agent.sap_hub import CACHED, LABEL, LIVE, SapHubClient, SapHubSettings
from quality_agent.service import propose_root_cause
from quality_agent.tools import Toolbox

FAKE_KEY = "fake-hub-key-for-tests"
NCR_100 = {"id": "NCR-2026-100", "title": "Coating thickness below specification", "area": "Coating",
           "description": "Coating thickness below the specified minimum on painted brackets; spray gun nozzle wear suspected."}


def refuse(request):
    raise AssertionError("no HTTP call expected")


@pytest.fixture
def key_file(tmp_path):
    path = tmp_path / "hub-key.txt"
    path.write_text(FAKE_KEY + "\n", encoding="utf-8")
    return path


def client(key_file, handler, **overrides):
    settings = SapHubSettings(api_key_file=key_file, base_url="https://sandbox.example.test/s4hanacloud/",
                              service_path="/qm-service-to-be-chosen/Rows")
    return SapHubClient(SapHubSettings(**{**settings.__dict__, **overrides}), transport=httpx.MockTransport(handler))


def test_settings_need_all_three_variables(tmp_path):
    env = {"SAP_HUB_API_KEY_FILE": str(tmp_path / "k"), "SAP_HUB_BASE_URL": "https://x", "SAP_HUB_SERVICE_PATH": "/p"}
    assert SapHubSettings.from_env(env).configured
    for name in env:
        assert not SapHubSettings.from_env({k: v for k, v in env.items() if k != name}).configured


def test_unconfigured_uses_the_cached_placeholder_without_http():
    result = SapHubClient(SapHubSettings(), transport=httpx.MockTransport(refuse)).quality_context()
    assert result["label"] == LABEL == "SAP sandbox sample data (not current-lot evidence)"
    assert result["source"] == CACHED == "cached sample"
    assert result["placeholder"] is True
    assert "not set" in result["fallback_reason"]
    assert "PLACEHOLDER" in json.dumps(result["records"])


def test_live_sandbox_sends_the_api_key_header_and_keeps_scalar_fields(key_file):
    seen = {}

    def handler(request):
        seen["request"] = request
        return httpx.Response(200, json={"d": {"results": [{"__metadata": {"uri": "x"}, "A": "a" * 300, "B": 2, "Nested": {"x": 1}}]}})

    result = client(key_file, handler).quality_context()
    request = seen["request"]
    assert request.headers["APIKey"] == FAKE_KEY
    assert str(request.url).startswith("https://sandbox.example.test/s4hanacloud/qm-service-to-be-chosen/Rows?")
    assert request.url.params["$top"] == "5"
    assert result["source"] == LIVE and result["label"] == LABEL and result["placeholder"] is False
    assert result["records"] == [{"A": "a" * 200, "B": 2}]
    assert result["record_count"] == 1


def test_odata_v4_value_list_is_read(key_file):
    result = client(key_file, lambda r: httpx.Response(200, json={"value": [{"X": 1}, {"X": 2}]})).quality_context()
    assert result["source"] == LIVE and result["records"] == [{"X": 1}, {"X": 2}]


@pytest.mark.parametrize("handler, reason", [
    (lambda r: httpx.Response(401, text="Invalid ApiKey " + FAKE_KEY), "HTTP 401"),
    (lambda r: httpx.Response(200, text="<html>not json</html>"), "unexpected response shape"),
    (lambda r: httpx.Response(200, json={"unexpected": True}), "unexpected response shape"),
])
def test_errors_fall_back_to_the_cached_sample_without_leaking_the_key(key_file, handler, reason):
    hub = client(key_file, handler)
    result = hub.quality_context()
    assert result["source"] == CACHED and result["fallback_reason"] == reason
    assert FAKE_KEY not in json.dumps(result) and FAKE_KEY not in repr(hub)


def test_network_error_and_unreadable_key_fall_back(key_file, tmp_path):
    def down(request):
        raise httpx.ConnectError("offline")

    assert client(key_file, down).quality_context()["fallback_reason"] == "network error (ConnectError)"
    missing = client(key_file, refuse, api_key_file=tmp_path / "missing.txt").quality_context()
    assert missing["source"] == CACHED and missing["fallback_reason"] == "SAP_HUB_API_KEY_FILE could not be read"


def live_hub(key_file):
    # Sandbox rows that look like evidence ids must still never count as current-lot evidence.
    return client(key_file, lambda r: httpx.Response(200, json={"value": [{"Lot": "TR-100", "Result": "confirmed"}]}))


def test_tool_records_only_its_source_and_never_an_ncr_or_evidence(corpus, key_file):
    toolbox = Toolbox(corpus, corpus.keyword_retriever(), sap_hub=live_hub(key_file))
    toolbox.get_sap_quality_context()
    assert toolbox.retrieved == {}
    assert toolbox.sap_context_calls == [{"tool": "get_sap_quality_context", "label": LABEL, "source": LIVE, "placeholder": False}]


def test_sandbox_context_never_unlocks_d4(corpus, key_file):
    payload = {"action": "propose_root_cause", "ncr": NCR_100, "current_evidence": []}
    response = propose_root_cause(payload, MockEngine(), corpus, corpus.keyword_retriever(), live_hub(key_file))
    assert response["sap_context"] == [{"tool": "get_sap_quality_context", "label": LABEL, "source": LIVE, "placeholder": False}]
    assert response["proposal_status"] in ("unverified_hypothesis", "no_hypothesis")
    assert "TR-100" not in json.dumps(response["proposal"])


class SandboxCitingEngine:
    mode = "scripted"
    model_id = None
    model_name = None

    def propose(self, req, toolbox):
        ids = [r["id"] for r in toolbox.search_similar_ncr(req.ncr["title"] + ". " + req.ncr["description"])["results"]]
        return Proposal(root_cause="Hypothesis: nozzle wear as in " + ids[0] + ", confirmed by SAP sandbox data (lot TR-100).",
                        cited_ncr_ids=ids[:1], confidence="high", missing_data=["Current-lot trial."])


def test_validator_rejects_a_proposal_that_uses_sandbox_data_as_confirmation(corpus, key_file):
    payload = {"action": "propose_root_cause", "ncr": NCR_100, "current_evidence": []}
    response = propose_root_cause(payload, SandboxCitingEngine(), corpus, corpus.keyword_retriever(), live_hub(key_file))
    assert response["accepted"] is False
    assert "SANDBOX_DATA_AS_EVIDENCE" in [i["code"] for i in response["validation"]["issues"]]
    assert response["proposal"]["root_cause"] is None
    assert response["proposal_status"] == "no_hypothesis"


class RecordingEngine:
    """Records the request it gets and calls no SAP tool itself."""

    mode = "scripted"
    model_id = None
    model_name = None

    def __init__(self):
        self.requests = []

    def propose(self, req, toolbox):
        self.requests.append(req)
        return Proposal(root_cause=None, confidence="low", missing_data=["Evidence missing."])


@pytest.mark.parametrize("engine_factory", [MockEngine, RecordingEngine])
def test_service_fetches_sap_context_once_per_request_whatever_the_engine_does(corpus, engine_factory):
    payload = {"action": "propose_root_cause", "ncr": NCR_100, "current_evidence": []}
    response = propose_root_cause(payload, engine_factory(), corpus, corpus.keyword_retriever(),
                                  SapHubClient(SapHubSettings(), transport=httpx.MockTransport(refuse)))
    assert response["sap_context"] == [{"tool": "get_sap_quality_context", "label": LABEL, "source": CACHED, "placeholder": True}]


def test_engine_receives_the_sap_context_and_the_prompt_marks_a_placeholder(corpus):
    from quality_agent.engines import sap_context_prompt

    engine = RecordingEngine()
    payload = {"action": "propose_root_cause", "ncr": NCR_100, "current_evidence": []}
    propose_root_cause(payload, engine, corpus, corpus.keyword_retriever(), SapHubClient(SapHubSettings()))
    context = engine.requests[0].sap_context
    assert context["source"] == CACHED and context["placeholder"] is True
    prompt = sap_context_prompt(context)
    assert LABEL in prompt and "PLACEHOLDER content, not SAP data" in prompt and "not evidence" in prompt
    assert sap_context_prompt(None) == ""
