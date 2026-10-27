"""draft_section: agent drafts for D2 and D3, without a model.

D2: the NCR restated in 5W2H form from the NCR fields and its description (which holds any extracted document
  text). A field that the NCR does not hold is written "Evidence missing", never inferred.
D3: containment actions reused from the containment of similar historical NCRs, each citing the NCR it reuses.
  The containment check (action_validator.validate_containment_actions) withholds uncited and generic actions.
"""

from __future__ import annotations

import re
from typing import Any

from .action_validator import validate_containment_actions
from .corpus import Corpus
from .retrieval import Retriever
from .service import RequestError
from .tools import Toolbox

ACTION = "draft_section"
MISSING = "Evidence missing"
D3_K = 3
_DETECTION = re.compile(r"\b(?:inspection|inspected|x-ray|xray|patrol|test(?:ed|ing)?|audit|found by|detected|measured|gauge|"
                        r"customer|complaint|ditemukan|inspeksi|pengujian|terdeteksi)\b", re.IGNORECASE)
_PROBLEM = re.compile(r"\b(?:exceed(?:s|ed|ing)?|beyond|above|below|out of (?:tolerance|spec(?:ification)?)|limit|tolerance|"
                      r"spec(?:ification)?|reject(?:ed)?|leak(?:s|ing)?|melebihi|di bawah|di atas|toleransi|spesifikasi|batas)\b", re.IGNORECASE)
_OF_TOTAL = re.compile(r"\b(\d{1,7})\s*(?:of|out of|/|dari)\s*(\d{1,7})\b", re.IGNORECASE)


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", text) if s.strip()]


def _first(pattern: re.Pattern[str], text: str) -> str | None:
    return next((s for s in _sentences(text) if pattern.search(s)), None)


def _field(ncr: dict, key: str) -> str | None:
    value = ncr.get(key)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value) if value > 0 else None
    return value.strip() if isinstance(value, str) and value.strip() else None


def d2_lines(ncr: dict) -> list[tuple[str, str | None]]:
    description = _field(ncr, "description") or ""
    what = " · ".join(v for v in (_field(ncr, "title"), _field(ncr, "category") and (_field(ncr, "category") + (" " + _field(ncr, "code") if _field(ncr, "code") else ""))) if v) or None
    where = ", ".join(v for v in (_field(ncr, "area"), _field(ncr, "lot") and "lot " + _field(ncr, "lot")) if v) or None
    quantity = _field(ncr, "quantity")
    of_total = _OF_TOTAL.search(description)
    how_many = (quantity + " affected units" + (" of " + of_total.group(2) + " (as stated in the description)" if of_total and of_total.group(1) == quantity else "")) if quantity else None
    return [
        ("What", what),
        ("Where", where),
        ("When", "NCR recorded " + _field(ncr, "date") + "; time of occurrence not recorded" if _field(ncr, "date") else None),
        ("Who", "Assigned engineer " + _field(ncr, "owner") if _field(ncr, "owner") else None),
        ("Why it is a problem", _first(_PROBLEM, description)),
        ("How it was detected", _first(_DETECTION, description)),
        ("How many", how_many),
    ]


def draft_d2(ncr: dict) -> dict[str, Any]:
    lines = d2_lines(ncr)
    missing = [k for k, v in lines if v is None]
    text = ("Agent draft (5W2H from the NCR fields, rule-based, no model, not validated):\n"
            + "\n".join("- " + k + ": " + (v if v is not None else MISSING + ".") for k, v in lines))
    if missing:
        text += "\nMissing data: " + ", ".join(missing) + " not recorded in the NCR."
    return {"lines": [{"key": k, "value": v} for k, v in lines], "missing": missing, "draft": text}


def draft_d3(ncr: dict, corpus: Corpus, retriever: Retriever, evidence: list) -> dict[str, Any]:
    toolbox = Toolbox(corpus, retriever, k=D3_K)
    results = toolbox.search_similar_ncr((_field(ncr, "title") or "") + ". " + (_field(ncr, "description") or ""))["results"]
    actions: list[dict] = []
    seen: set[str] = set()
    for r in results:
        record = corpus.get(r["id"]) or {}
        containment = (record.get("containment") or "").strip()
        if containment and containment not in seen:
            seen.add(containment)
            actions.append({"action": containment.rstrip(".") + " (reuses the containment of " + r["id"] + ").", "cited_ncr_ids": [r["id"]], "evidence_ids": []})
    issues = validate_containment_actions(actions, toolbox.retrieved_ids, current_ncr_id=ncr["id"], evidence_registry=evidence + corpus.evidence_refs())
    failed = {i.index for i in issues}
    accepted = [a for n, a in enumerate(actions) if n not in failed]
    rejected = [{**a, "issues": [i.to_dict() for i in issues if i.index == n]} for n, a in enumerate(actions) if n in failed]
    if accepted:
        text = ("Agent proposal (containment reused from retrieved cases, no model, not validated). Adapt lot numbers and quantities to "
                + ncr["id"] + " before approval:\n" + "\n".join(str(n + 1) + ". " + a["action"] for n, a in enumerate(accepted)))
    else:
        text = MISSING + ". No containment from a similar historical NCR applies; define containment for " + ncr["id"] + " from the current lot."
    return {"actions": accepted, "rejected": rejected, "draft": text,
            "retrieved": [{"id": i, "score": s, "title": (corpus.get(i) or {}).get("title", "")} for i, s in toolbox.retrieved.items()]}


def draft_section(payload: Any, corpus: Corpus, retriever: Retriever) -> dict[str, Any]:
    from .service import parse_request

    if not isinstance(payload, dict) or payload.get("action") != ACTION:
        raise RequestError('Use action "' + ACTION + '".')
    section = payload.get("section")
    if section not in ("D2", "D3"):
        raise RequestError('section must be "D2" or "D3".')
    base = parse_request({**payload, "action": "propose_root_cause"})
    ncr = {**{k: v for k, v in payload["ncr"].items() if isinstance(v, (str, int, float))}, "id": base.ncr["id"]}
    body = draft_d2(ncr) if section == "D2" else draft_d3(ncr, corpus, retriever, base.current_evidence)
    return {"status": "success", "task": ACTION, "section": section, "method": "rule-based, no model", "ncr_id": ncr["id"], **body}
