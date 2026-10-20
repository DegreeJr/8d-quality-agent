"""propose_root_cause: runs an engine, then enforces the validator on its output."""

from __future__ import annotations

import re
from typing import Any

from .corpus import Corpus
from .engines import Engine, EngineRequest, Proposal
from .retrieval import Retriever
from .tools import Toolbox
from .validator import EvidenceRef, validate_root_cause

_NCR_ID = re.compile(r"^NCR-\d{4}-\d{3}$", re.IGNORECASE)


class RequestError(ValueError):
    pass


def parse_request(payload: Any) -> EngineRequest:
    if not isinstance(payload, dict):
        raise RequestError("Payload must be a JSON object.")
    if payload.get("action") != "propose_root_cause":
        raise RequestError('Unsupported action. Use "propose_root_cause".')
    ncr = payload.get("ncr")
    if not isinstance(ncr, dict) or not isinstance(ncr.get("id"), str) or not _NCR_ID.match(ncr["id"]):
        raise RequestError("ncr.id must be an NCR id such as NCR-2026-104.")
    for key in ("title", "description", "area"):
        if not isinstance(ncr.get(key, ""), str):
            raise RequestError("ncr." + key + " must be a string.")
    if not (ncr.get("title") or ncr.get("description")):
        raise RequestError("ncr.title or ncr.description is required.")
    ncr_id = ncr["id"].upper()
    evidence = payload.get("current_evidence", [])
    if not isinstance(evidence, list) or not all(isinstance(e, dict) and isinstance(e.get("id"), str) and isinstance(e.get("ncrId"), str) for e in evidence):
        raise RequestError("current_evidence must be a list of {id, ncrId}.")
    # Only evidence that the caller says belongs to this NCR is considered current-lot evidence.
    refs = [EvidenceRef(e["id"].upper(), e["ncrId"].upper()) for e in evidence if e["ncrId"].upper() == ncr_id]
    return EngineRequest(ncr={**{k: ncr.get(k, "") for k in ("title", "description", "area")}, "id": ncr_id}, current_evidence=refs)


def proposal_text(proposal: Proposal) -> str:
    """The text the validator checks: the hypothesis plus every cited id."""
    text = proposal.root_cause or "Evidence missing."
    if proposal.cited_ncr_ids:
        text += " Cited: " + ", ".join(proposal.cited_ncr_ids) + "."
    return text


def propose_root_cause(payload: Any, engine: Engine, corpus: Corpus, retriever: Retriever) -> dict[str, Any]:
    request = parse_request(payload)
    toolbox = Toolbox(corpus, retriever)
    raw = engine.propose(request, toolbox)
    # Rule A uses the ids the tools returned in this invocation, not ids the model claims to have retrieved.
    validation = validate_root_cause(
        proposal_text(raw), toolbox.retrieved_ids, current_ncr_id=request.ncr["id"],
        evidence_registry=request.current_evidence + corpus.evidence_refs(),
    )
    if validation.ok:
        final = raw
    else:
        codes = ", ".join(i.code for i in validation.issues)
        final = Proposal(root_cause=None, cited_ncr_ids=[], confidence="low",
                         missing_data=[*raw.missing_data, "Evidence missing: the proposal was rejected by the root cause check (" + codes + ")."])
    return {
        "status": "success",
        "mode": engine.mode,
        "model_id": engine.model_id,
        "ncr_id": request.ncr["id"],
        "proposal": final.model_dump(),
        # Kept for audit when the check rejects the model output.
        "raw_proposal": None if validation.ok else raw.model_dump(),
        "retrieved": [
            {"id": ncr_id, "score": score, "title": (corpus.get(ncr_id) or {}).get("title", "")}
            for ncr_id, score in toolbox.retrieved.items()
        ],
        "validation": validation.to_dict(),
        "accepted": validation.ok,
    }
