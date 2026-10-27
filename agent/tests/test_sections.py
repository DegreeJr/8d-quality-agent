"""D2 (5W2H) and D3 (containment) agent drafts without a model."""

import pytest
from starlette.testclient import TestClient

from conftest import NCR_104
from quality_agent.app import create_app
from quality_agent.sections import draft_section
from quality_agent.service import RequestError

FULL = {**NCR_104, "code": "POR-01", "category": "Porosity", "severity": "Major", "owner": "Sarah Chen", "date": "2026-10-12",
        "quantity": 48, "lot": "LOT-DC-2410"}


def run(corpus, section, ncr=FULL, retriever=None):
    return draft_section({"action": "draft_section", "section": section, "ncr": ncr, "current_evidence": []}, corpus,
                         retriever or corpus.keyword_retriever())


def test_d2_restates_the_ncr_in_5w2h_from_its_fields_only(corpus):
    r = run(corpus, "D2")
    lines = dict((x["key"], x["value"]) for x in r["lines"])
    assert lines == {
        "What": "Porosity in aluminum motor housing · Porosity POR-01",
        "Where": "Die casting, lot LOT-DC-2410",
        "When": "NCR recorded 2026-10-12; time of occurrence not recorded",
        "Who": "Assigned engineer Sarah Chen",
        "Why it is a problem": "Pore clusters exceed the 1.5 mm acceptance limit near the mounting boss.",
        "How it was detected": "X-ray inspection detected internal porosity on 48 of 320 aluminum motor housings.",
        "How many": "48 affected units of 320 (as stated in the description)",
    }
    assert r["missing"] == [] and r["method"] == "rule-based, no model"
    assert r["draft"].startswith("Agent draft (5W2H from the NCR fields, rule-based, no model, not validated):\n- What: ")


def test_d2_writes_evidence_missing_instead_of_inventing(corpus):
    sparse = {"id": "NCR-2026-200", "title": "Odd noise", "description": "Something sounds wrong on the line."}
    r = run(corpus, "D2", sparse)
    assert r["missing"] == ["Where", "When", "Who", "Why it is a problem", "How it was detected", "How many"]
    assert "- Where: Evidence missing." in r["draft"] and "- How many: Evidence missing." in r["draft"]
    assert r["draft"].endswith("Missing data: Where, When, Who, Why it is a problem, How it was detected, How many not recorded in the NCR.")


def test_d3_reuses_containment_of_retrieved_cases_each_with_its_citation(corpus):
    r = run(corpus, "D3")
    retrieved = {h["id"] for h in r["retrieved"]}
    assert r["actions"] and r["rejected"] == []
    for a in r["actions"]:
        assert len(a["cited_ncr_ids"]) == 1 and a["cited_ncr_ids"][0] in retrieved
        assert corpus.get(a["cited_ncr_ids"][0])["containment"].rstrip(".") in a["action"]
    assert "Adapt lot numbers and quantities to NCR-2026-104 before approval" in r["draft"]


def test_d3_without_retrieval_says_evidence_missing(corpus):
    class Nothing:
        def search(self, query, k):
            return []

    r = run(corpus, "D3", retriever=Nothing())
    assert r["actions"] == [] and r["draft"].startswith("Evidence missing. No containment from a similar historical NCR applies")


@pytest.mark.parametrize("payload, match", [
    ({"action": "draft_section", "section": "D4", "ncr": FULL}, 'section must be "D2" or "D3"'),
    ({"action": "draft_section", "section": "D2", "ncr": {"id": "bad"}}, "ncr.id"),
])
def test_bad_section_requests_are_refused(corpus, payload, match):
    with pytest.raises(RequestError, match=match):
        draft_section(payload, corpus, corpus.keyword_retriever())


def test_invocations_dispatch_draft_section(mock_settings):
    body = TestClient(create_app(mock_settings)).post("/invocations", json={"action": "draft_section", "section": "D3", "ncr": FULL}).json()
    assert body["status"] == "success" and body["section"] == "D3" and body["actions"]


@pytest.mark.parametrize("section", ["D2", "D3"])
def test_section_contract_fixtures(corpus, section):
    import json
    import os

    from conftest import REPO

    fixture = REPO / "tests" / "fixtures" / ("section-response-" + section.lower() + "-104.json")
    r = run(corpus, section)
    if os.environ.get("UPDATE_FIXTURES") == "1":
        fixture.write_text(json.dumps(r, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    assert r == json.loads(fixture.read_text(encoding="utf-8"))
