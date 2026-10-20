"""The agent's two tools. Every NCR id a tool returns is recorded, so the service can check
citations against what was actually retrieved in this invocation rather than what the model claims."""

from __future__ import annotations

from typing import Any

from .corpus import Corpus
from .retrieval import Retriever

SEARCH_K = 3


class Toolbox:
    def __init__(self, corpus: Corpus, retriever: Retriever, k: int = SEARCH_K):
        self._corpus = corpus
        self._retriever = retriever
        self._k = k
        # Ordered, de-duplicated ids returned by tools, with the best search score seen.
        self.retrieved: dict[str, float | None] = {}

    @property
    def retrieved_ids(self) -> list[str]:
        return list(self.retrieved)

    def _record(self, ncr_id: str, score: float | None) -> None:
        previous = self.retrieved.get(ncr_id)
        if ncr_id not in self.retrieved or (score is not None and (previous is None or score > previous)):
            self.retrieved[ncr_id] = score

    def search_similar_ncr(self, description: str) -> dict[str, Any]:
        results = []
        for hit in self._retriever.search(description, self._k):
            ncr = self._corpus.get(hit.id)
            if ncr is None:
                continue
            self._record(hit.id, round(hit.score, 4))
            results.append({
                "id": ncr["id"], "title": ncr["title"], "area": ncr["area"], "score": round(hit.score, 4),
                "confirmedRootCause": ncr["confirmedRootCause"], "correctiveAction": ncr["correctiveAction"],
                "evidenceIds": ncr["evidenceIds"],
            })
        return {"results": results}

    def get_ncr(self, ncr_id: str) -> dict[str, Any]:
        ncr = self._corpus.get(ncr_id)
        if ncr is None:
            return {"error": "NCR " + ncr_id + " not found in the historical corpus."}
        self._record(ncr["id"], None)
        evidence = [self._corpus.evidence[e] for e in ncr["evidenceIds"] if e in self._corpus.evidence]
        return {**ncr, "evidence": evidence}

    def strands_tools(self) -> list[Any]:
        # Imported lazily so mock mode never loads the Strands SDK.
        from strands import tool

        @tool
        def search_similar_ncr(description: str) -> dict:
            """Search closed historical NCRs similar to a non-conformance description.

            Args:
                description: Title and description of the current non-conformance.
            """
            return self.search_similar_ncr(description)

        @tool
        def get_ncr(ncr_id: str) -> dict:
            """Get one closed historical NCR with its confirmed root cause, corrective action and evidence records.

            Args:
                ncr_id: Historical NCR id, for example NCR-2025-084.
            """
            return self.get_ncr(ncr_id)

        return [search_similar_ncr, get_ncr]
