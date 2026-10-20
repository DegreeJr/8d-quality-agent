"""Root cause validator, a port of src/lib/validator.ts. Same rules, codes and messages.

Rule A (citation integrity): every NCR id in the text must be one of the retrieved ids.
Rule B (generic claims): a generic root-cause phrase is rejected unless the text cites a retrieved NCR
  AND references current-lot evidence: an evidence id PREFIX-NNN that, when a registry is given, is
  registered to the NCR under investigation. Without a registry the id syntax alone counts.
Rule C (no evidence): with nothing retrieved, the text must state that evidence is missing and must
  not assert a root cause.
Rule D (unverified hypothesis): with a registry and a current NCR that owns no registered evidence, the
  status is "unverified_hypothesis": a hypothesis from precedents is allowed, but it must not be stated as
  confirmed, and a given missing-data list must not be empty. Otherwise the status is "evidence_registered".
Both suites run the cases in tests/fixtures/validator-cases.json.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field

GENERIC_PHRASES: tuple[str, ...] = (
    # English
    "human error", "operator error", "operator mistake", "operator negligence", "negligence",
    "needs training", "need training", "needs retraining", "lack of training", "insufficient training",
    "carelessness", "careless", "inattention", "lack of attention",
    # Indonesian
    "kurang teliti", "kelalaian operator", "kelalaian", "kesalahan manusia", "kesalahan operator",
    "operator lalai", "perlu training", "perlu pelatihan", "kurang training", "kurang pelatihan",
    "kurang hati-hati", "ceroboh",
)

EVIDENCE_PREFIXES: tuple[str, ...] = ("TR", "GR", "TI", "TD", "VT", "PL", "FV", "FP", "LAB")

# re.ASCII keeps \b and \s aligned with JavaScript regular expressions.
_FLAGS = re.IGNORECASE | re.ASCII
_NCR_ID = re.compile(r"\bNCR-\d{4}-\d{3}\b", _FLAGS)

_MISSING_EVIDENCE_STATEMENTS = [re.compile(p, _FLAGS) for p in (
    r"\bevidence\s+(?:is\s+)?missing\b",
    r"\bmissing\s+evidence\b",
    r"\bno\s+(?:supporting\s+)?evidence\b",
    r"\binsufficient\s+evidence\b",
    r"\b(?:tidak|belum)\s+ada\s+bukti\b",
    r"\bbukti\s+(?:tidak|belum)\s+(?:ada|tersedia|cukup)\b",
)]

# A root cause stated as fact. "Root cause: unknown" or "before selecting a root cause" is not an assertion.
_UNDECIDED = r"(?!\s*(?:unknown|undetermined|tbd|pending|not\s+(?:yet\s+)?(?:determined|confirmed|identified)|belum))"
_ROOT_CAUSE_ASSERTIONS = [re.compile(p, _FLAGS) for p in (
    r"\broot\s+cause\s*(?::|=|\bis\b|\bwas\b|\bhas\s+been\b|\bidentified\s+as\b|\bconfirmed\b)" + _UNDECIDED,
    r"\bconfirmed\s+root\s+cause\b",
    r"\bcaused\s+by\b",
    r"\bakar\s+(?:masalah|penyebab)(?:nya)?\s*(?::|=|\badalah\b|\bialah\b)" + _UNDECIDED,
    r"\bpenyebab(?:nya)?(?:\s+utama)?\s*(?::|=|\badalah\b|\bialah\b)" + _UNDECIDED,
    r"\bdisebabkan\s+oleh\b",
)]


# The current root cause stated as confirmed, verified or validated. Negations ("not yet confirmed",
# "belum terkonfirmasi") and words such as "unverified" do not match, nor does a historical cause
# "confirmed by tooling inspection", because it does not say "root cause".
_CLAIMED_CONFIRMED = [re.compile(p, _FLAGS) for p in (
    r"\b(?:root\s+cause|akar\s+(?:masalah|penyebab)|penyebab\s+utama)\b(?:(?!\bnot\b|\bbelum\b|\btidak\b)[^.;:]){0,40}?"
    r"\b(?:confirmed|verified|validated|terkonfirmasi|dikonfirmasi|terverifikasi|tervalidasi)\b",
    r"\b(?:confirmed|verified|validated)\s+root\s+cause\b",
    r"\b(?:terkonfirmasi|dikonfirmasi|terverifikasi)\s+sebagai\s+(?:akar|penyebab)\b",
)]

UNVERIFIED = "unverified_hypothesis"
EVIDENCE_REGISTERED = "evidence_registered"


@dataclass(frozen=True)
class ValidationIssue:
    code: str
    message: str


@dataclass(frozen=True)
class ValidationResult:
    ok: bool
    issues: list[ValidationIssue] = field(default_factory=list)
    # Set only when both a registry and the current NCR are known (Rule D).
    hypothesis_status: str | None = None

    def to_dict(self) -> dict:
        return {"ok": self.ok, "issues": [{"code": i.code, "message": i.message} for i in self.issues],
                "hypothesis_status": self.hypothesis_status}


@dataclass(frozen=True)
class EvidenceRef:
    id: str
    ncr_id: str


def _unique_upper(matches: Iterable[str]) -> list[str]:
    return list(dict.fromkeys(m.upper() for m in matches))


def cited_ncr_ids(text: str) -> list[str]:
    return _unique_upper(_NCR_ID.findall(text))


def generic_phrases_in(text: str) -> list[str]:
    return [p for p in GENERIC_PHRASES if re.search(r"\b" + r"\s+".join(re.escape(w) for w in p.split()) + r"\b", text, _FLAGS)]


def evidence_ids_in(text: str, prefixes: Sequence[str] = EVIDENCE_PREFIXES) -> list[str]:
    if not prefixes:
        return []
    pattern = re.compile(r"\b(?:" + "|".join(re.escape(p) for p in prefixes) + r")-\d{3,}\b", _FLAGS)
    return _unique_upper(pattern.findall(text))


def check_current_lot_evidence(text: str, current_ncr_id: str | None, registry: Sequence[EvidenceRef] | None,
                               prefixes: Sequence[str] = EVIDENCE_PREFIXES) -> tuple[list[str], list[str]]:
    """Returns (accepted ids, rejection reasons)."""
    ids = evidence_ids_in(text, prefixes)
    if registry is None:
        return ids, []
    current = current_ncr_id.upper() if current_ncr_id else None
    owners = {r.id.upper(): r.ncr_id.upper() for r in registry}
    accepted: list[str] = []
    rejected: list[str] = []
    for evidence_id in ids:
        owner = owners.get(evidence_id)
        if owner is None:
            rejected.append(evidence_id + " is not in the evidence registry")
        elif owner != current:
            rejected.append(evidence_id + " belongs to " + owner + (", not " + current if current else ""))
        else:
            accepted.append(evidence_id)
    return accepted, rejected


def validate_root_cause(text: str, retrieved_ids: Sequence[str], *, current_ncr_id: str | None = None,
                        evidence_registry: Sequence[EvidenceRef] | None = None,
                        evidence_prefixes: Sequence[str] = EVIDENCE_PREFIXES,
                        missing_data: Sequence[str] | None = None) -> ValidationResult:
    issues: list[ValidationIssue] = []
    retrieved = {i.upper() for i in retrieved_ids}
    current = current_ncr_id.upper() if current_ncr_id else None
    cited = [i for i in cited_ncr_ids(text) if i != current]

    # Rule A
    for ncr_id in (i for i in cited if i not in retrieved):
        issues.append(ValidationIssue("CITATION_NOT_RETRIEVED",
                                      ncr_id + " is cited but was not retrieved for this case. Cite only retrieved historical NCRs."))

    # Rule B
    generic = generic_phrases_in(text)
    if generic:
        cites_retrieved = any(i in retrieved for i in cited)
        accepted, rejected = check_current_lot_evidence(text, current, evidence_registry, evidence_prefixes)
        has_evidence = bool(accepted)
        if not cites_retrieved or not has_evidence:
            if evidence_registry is not None:
                example = next((r.id for r in evidence_registry if r.ncr_id.upper() == current), None)
            else:
                example = "TR-104"
            evidence_need = ("a current-lot evidence id"
                             + (" registered to this NCR" if evidence_registry is not None else "")
                             + (" such as " + example if example else "")
                             + (" (" + "; ".join(rejected) + ")" if rejected else ""))
            missing = " and ".join(part for part in (
                "a cited retrieved NCR" if not cites_retrieved else "",
                evidence_need if not has_evidence else "",
            ) if part)
            issues.append(ValidationIssue("GENERIC_CLAIM_UNSUPPORTED",
                                          'Generic claim "' + '", "'.join(generic) + '" needs ' + missing
                                          + '. Otherwise state "evidence missing".'))

    # Rule C
    if not retrieved:
        states_missing = any(r.search(text) for r in _MISSING_EVIDENCE_STATEMENTS)
        asserts = any(r.search(text) for r in _ROOT_CAUSE_ASSERTIONS)
        if not states_missing or asserts:
            parts = ["No historical evidence was retrieved."]
            if asserts:
                parts.append("Do not assert a root cause.")
            if not states_missing:
                parts.append("State that evidence is missing.")
            issues.append(ValidationIssue("ROOT_CAUSE_WITHOUT_EVIDENCE", " ".join(parts)))

    # Rule D
    status = None
    if evidence_registry is not None and current:
        has_current_lot = any(r.ncr_id.upper() == current for r in evidence_registry)
        status = EVIDENCE_REGISTERED if has_current_lot else UNVERIFIED
        if not has_current_lot:
            if any(r.search(text) for r in _CLAIMED_CONFIRMED):
                issues.append(ValidationIssue("ROOT_CAUSE_CLAIMED_CONFIRMED",
                                              "No current-lot evidence is registered for " + current + ", so the root cause is an "
                                              "unverified hypothesis and must not be stated as confirmed."))
            if missing_data is not None and len(missing_data) == 0:
                issues.append(ValidationIssue("MISSING_DATA_REQUIRED",
                                              "No current-lot evidence is registered for " + current
                                              + ". List the missing data needed to verify the hypothesis."))

    return ValidationResult(ok=not issues, issues=issues, hypothesis_status=status)
