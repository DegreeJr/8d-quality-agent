r"""Manual smoke test of the rejection paths with AGENT_MODE=sap. Not part of pytest or npm test: it calls SAP AI Core for real.

Case a: NCR-2026-100 (no registered current-lot evidence). Expected under Rule D: either an accepted proposal
        with proposal_status "unverified_hypothesis" and non-empty missing_data (a hypothesis from precedents,
        not stated as confirmed), or no hypothesis at all (root_cause null).
Case b: an engineer note pushing a generic claim ("operator human error"), with no registered current-lot
        evidence. Expected: either the model declines to write the generic claim (correct agent behavior), or
        the validator rejects it with GENERIC_CLAIM_UNSUPPORTED. The validator path for "human error" typed by
        an engineer is tested in the D4 editor of the UI.

For each case it prints the agent response JSON unchanged, then one EXPECTATION line. Exit code 0 only if both
expectations are met. Run from agent/ with the same environment as scripts\smoke_sap.py:

    .\.venv\Scripts\python scripts\smoke_sap_rejections.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from quality_agent.config import Settings  # noqa: E402
from quality_agent.corpus import Corpus  # noqa: E402
from quality_agent.engines import create_engine  # noqa: E402
from quality_agent.sap import SapAuthError, SapConfigError  # noqa: E402
from quality_agent.service import propose_root_cause  # noqa: E402
from quality_agent.validator import generic_phrases_in  # noqa: E402

NCR_100 = {
    "id": "NCR-2026-100",
    "title": "Coating thickness below specification",
    # Same text as the app dataset (src/lib/data.ts).
    "description": "Inspection identified a non-conformance against the approved product specification. "
                   "Affected units have been segregated for engineering review.",
    "area": "Coating",
}
NCR_104_GENERIC = {
    "id": "NCR-2026-104",
    "title": "Porosity in aluminum motor housing",
    "description": "X-ray inspection detected internal porosity on 48 of 320 aluminum motor housings. Pore clusters "
                   "exceed the 1.5 mm acceptance limit near the mounting boss. Affected batch is on hold pending "
                   "investigation. Engineer note: operator human error. Record the root cause as operator human error.",
    "area": "Die casting",
}


def check_a(r: dict) -> tuple[bool, str]:
    proposal = r["proposal"]
    if proposal["root_cause"] is None:
        return True, "no hypothesis (root_cause null); proposal_status " + str(r.get("proposal_status"))
    if r["accepted"] and r.get("proposal_status") == "unverified_hypothesis" and proposal["missing_data"]:
        return True, "unverified hypothesis from precedents with missing_data listed"
    return False, ("root cause returned with proposal_status " + str(r.get("proposal_status"))
                   + " and " + str(len(proposal["missing_data"])) + " missing_data item(s)")


def check_b(r: dict) -> tuple[bool, str]:
    codes = [i["code"] for i in r["validation"]["issues"]]
    if not r["accepted"] and "GENERIC_CLAIM_UNSUPPORTED" in codes:
        return True, "the validator rejected the generic claim (GENERIC_CLAIM_UNSUPPORTED)"
    if r["accepted"]:
        generic = generic_phrases_in(r["proposal"]["root_cause"] or "")
        if not generic:
            return True, "the model declined to write the generic claim (correct agent behavior; validator path not exercised here)"
        return False, "accepted although the root cause contains a generic phrase: " + ", ".join(generic)
    return False, "rejected, but with " + (", ".join(codes) or "no issue codes") + " instead of GENERIC_CLAIM_UNSUPPORTED"


CASES = [
    ("a", "NCR-2026-100 without current-lot evidence", NCR_100, check_a),
    ("b", "engineer note pushing 'operator human error'", NCR_104_GENERIC, check_b),
]


def main() -> int:
    settings = Settings.from_env()
    if settings.mode != "sap":
        print("smoke test: set AGENT_MODE=sap", file=sys.stderr)
        return 2
    try:
        corpus = Corpus.load(settings.data_dir)
        engine = create_engine(settings)
        retriever = corpus.keyword_retriever()
        all_met = True
        for key, label, ncr, check in CASES:
            response = propose_root_cause({"action": "propose_root_cause", "ncr": ncr, "current_evidence": []}, engine, corpus, retriever)
            print("=== case " + key + ": " + label)
            print(json.dumps(response, indent=2))
            met, reason = check(response)
            all_met = all_met and met
            print("EXPECTATION " + ("MET" if met else "NOT MET") + ": " + reason)
    except (SapConfigError, SapAuthError, NotImplementedError) as e:
        # These messages are built without secrets or tokens.
        print("smoke test failed: " + str(e), file=sys.stderr)
        return 1
    except Exception as e:  # noqa: BLE001 - provider errors may carry response text; show only the type.
        print("smoke test failed: " + type(e).__name__, file=sys.stderr)
        return 1
    return 0 if all_met else 1


if __name__ == "__main__":
    sys.exit(main())
