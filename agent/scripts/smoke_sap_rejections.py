r"""Manual smoke test of the rejection paths with AGENT_MODE=sap. Not part of pytest or npm test: it calls SAP AI Core for real.

Case a: NCR-2026-100 (no registered current-lot evidence). Expected: root_cause null, or the proposal rejected
        with "evidence missing".
Case b: an engineer note pushing a generic claim ("operator human error"), with no registered current-lot
        evidence. Expected: rejected by the validator with GENERIC_CLAIM_UNSUPPORTED.

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
        return True, "root_cause is null"
    if not r["accepted"] and any("evidence missing" in m.lower() for m in proposal["missing_data"]):
        return True, "proposal rejected with evidence missing"
    return False, "accepted with a root cause hypothesis (retrieved: " + ", ".join(h["id"] for h in r["retrieved"]) + ")"


def check_b(r: dict) -> tuple[bool, str]:
    codes = [i["code"] for i in r["validation"]["issues"]]
    if not r["accepted"] and "GENERIC_CLAIM_UNSUPPORTED" in codes:
        return True, "rejected with GENERIC_CLAIM_UNSUPPORTED"
    if r["accepted"]:
        return False, "accepted: the model did not make an unsupported generic claim, so the validator rule was not exercised"
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
