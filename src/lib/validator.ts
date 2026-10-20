// Root cause validator: the agent's signature rule, as pure functions with no side effects.
//
// Rule A (citation integrity): every NCR id in the text (/NCR-\d{4}-\d{3}/, case-insensitive)
//   must be one of the retrieved ids. Otherwise: CITATION_NOT_RETRIEVED.
// Rule B (generic claims): a generic root-cause phrase (English or Indonesian, see GENERIC_PHRASES)
//   is rejected with GENERIC_CLAIM_UNSUPPORTED unless BOTH hold:
//     1. at least one retrieved NCR id is cited in the text, AND
//     2. the text references objective current-lot evidence: an evidence record id PREFIX-NNN,
//        where PREFIX is one of EVIDENCE_PREFIXES, that is listed in options.evidenceRegistry
//        with ncrId equal to options.currentNcrId. For NCR-2026-104, TR-104 counts; GR-032
//        (owned by NCR-2026-032) and TR-999 (not registered) do not.
//   Without a registry the check falls back to the id syntax alone and cannot confirm ownership.
// Rule C (no evidence): when the retrieved set is empty, the text must state that evidence is
//   missing and must not assert a root cause. Otherwise: ROOT_CAUSE_WITHOUT_EVIDENCE.
// Rule D (unverified hypothesis): when a registry and the current NCR are given and no evidence
//   record is registered to that NCR, the result is hypothesisStatus "unverified_hypothesis".
//   A hypothesis from precedents is still allowed, but the text must not state the root cause as
//   confirmed (ROOT_CAUSE_CLAIMED_CONFIRMED), and when options.missingData is given it must not be
//   empty (MISSING_DATA_REQUIRED). With registered evidence the status is "evidence_registered".

import type { EvidenceRecord } from './types';

export type ValidationIssueCode = 'CITATION_NOT_RETRIEVED' | 'GENERIC_CLAIM_UNSUPPORTED' | 'ROOT_CAUSE_WITHOUT_EVIDENCE' | 'ROOT_CAUSE_CLAIMED_CONFIRMED' | 'MISSING_DATA_REQUIRED';
export type HypothesisStatus = 'unverified_hypothesis' | 'evidence_registered';

export interface ValidationIssue {
    code: ValidationIssueCode;
    message: string;
}

export interface ValidationResult {
    ok: boolean;
    issues: ValidationIssue[];
    // Set only when both a registry and the current NCR are known (Rule D).
    hypothesisStatus?: HypothesisStatus;
}

export interface ValidateOptions {
    // Id of the case under investigation. Mentioning it is not a citation of a precedent.
    currentNcrId?: string;
    // Overrides EVIDENCE_PREFIXES.
    evidencePrefixes?: readonly string[];
    // When given, only evidence ids registered to currentNcrId count as current-lot evidence.
    evidenceRegistry?: readonly Pick<EvidenceRecord, 'id' | 'ncrId'>[];
    // Missing-data list of a structured proposal. Rule D requires it to be non-empty when given.
    missingData?: readonly string[];
}

export const GENERIC_PHRASES: readonly string[] = [
    // English
    'human error', 'operator error', 'operator mistake', 'operator negligence', 'negligence',
    'needs training', 'need training', 'needs retraining', 'lack of training', 'insufficient training',
    'carelessness', 'careless', 'inattention', 'lack of attention',
    // Indonesian
    'kurang teliti', 'kelalaian operator', 'kelalaian', 'kesalahan manusia', 'kesalahan operator',
    'operator lalai', 'perlu training', 'perlu pelatihan', 'kurang training', 'kurang pelatihan',
    'kurang hati-hati', 'ceroboh'
];

// Evidence record prefixes used in this dataset: trial report, gauge study, tooling inspection,
// teardown, validation test, parameter log, first-off verification, fixture photos, lab report.
export const EVIDENCE_PREFIXES: readonly string[] = ['TR', 'GR', 'TI', 'TD', 'VT', 'PL', 'FV', 'FP', 'LAB'];

const NCR_ID = /\bNCR-\d{4}-\d{3}\b/gi;

const MISSING_EVIDENCE_STATEMENTS: readonly RegExp[] = [
    /\bevidence\s+(?:is\s+)?missing\b/i,
    /\bmissing\s+evidence\b/i,
    /\bno\s+(?:supporting\s+)?evidence\b/i,
    /\binsufficient\s+evidence\b/i,
    /\b(?:tidak|belum)\s+ada\s+bukti\b/i,
    /\bbukti\s+(?:tidak|belum)\s+(?:ada|tersedia|cukup)\b/i
];

// A root cause stated as fact. "Root cause: unknown" or "before selecting a root cause" is not an assertion.
const UNDECIDED = '(?!\\s*(?:unknown|undetermined|tbd|pending|not\\s+(?:yet\\s+)?(?:determined|confirmed|identified)|belum))';
const ROOT_CAUSE_ASSERTIONS: readonly RegExp[] = [
    new RegExp('\\broot\\s+cause\\s*(?::|=|\\bis\\b|\\bwas\\b|\\bhas\\s+been\\b|\\bidentified\\s+as\\b|\\bconfirmed\\b)' + UNDECIDED, 'i'),
    /\bconfirmed\s+root\s+cause\b/i,
    /\bcaused\s+by\b/i,
    new RegExp('\\bakar\\s+(?:masalah|penyebab)(?:nya)?\\s*(?::|=|\\badalah\\b|\\bialah\\b)' + UNDECIDED, 'i'),
    new RegExp('\\bpenyebab(?:nya)?(?:\\s+utama)?\\s*(?::|=|\\badalah\\b|\\bialah\\b)' + UNDECIDED, 'i'),
    /\bdisebabkan\s+oleh\b/i
];

// The current root cause stated as confirmed, verified or validated. Negations ("not yet confirmed",
// "belum terkonfirmasi") and words such as "unverified" do not match. A historical cause described as
// "confirmed by tooling inspection" does not match either, because it does not say "root cause".
const CLAIMED_CONFIRMED: readonly RegExp[] = [
    /\b(?:root\s+cause|akar\s+(?:masalah|penyebab)|penyebab\s+utama)\b(?:(?!\bnot\b|\bbelum\b|\btidak\b)[^.;:]){0,40}?\b(?:confirmed|verified|validated|terkonfirmasi|dikonfirmasi|terverifikasi|tervalidasi)\b/i,
    /\b(?:confirmed|verified|validated)\s+root\s+cause\b/i,
    /\b(?:terkonfirmasi|dikonfirmasi|terverifikasi)\s+sebagai\s+(?:akar|penyebab)\b/i
];

function escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function citedNcrIds(text: string): string[] {
    return [...new Set((text.match(NCR_ID) ?? []).map(id => id.toUpperCase()))];
}

export function genericPhrasesIn(text: string): string[] {
    return GENERIC_PHRASES.filter(p => new RegExp('\\b' + escapeRegExp(p).replace(/\s+/g, '\\s+') + '\\b', 'i').test(text));
}

export function evidenceIdsIn(text: string, prefixes: readonly string[] = EVIDENCE_PREFIXES): string[] {
    if (!prefixes.length)
        return [];
    const pattern = new RegExp('\\b(?:' + prefixes.map(escapeRegExp).join('|') + ')-\\d{3,}\\b', 'gi');
    return [...new Set((text.match(pattern) ?? []).map(id => id.toUpperCase()))];
}

export interface EvidenceCheck {
    accepted: string[];
    rejected: { id: string; reason: string }[];
}

// Sorts the evidence ids in the text into those that count as current-lot evidence and those that do not.
export function checkCurrentLotEvidence(text: string, options: ValidateOptions = {}): EvidenceCheck {
    const ids = evidenceIdsIn(text, options.evidencePrefixes);
    if (!options.evidenceRegistry)
        return { accepted: ids, rejected: [] };
    const current = options.currentNcrId?.toUpperCase();
    const owners = new Map(options.evidenceRegistry.map(r => [r.id.toUpperCase(), r.ncrId.toUpperCase()]));
    const result: EvidenceCheck = { accepted: [], rejected: [] };
    for (const id of ids) {
        const owner = owners.get(id);
        if (!owner)
            result.rejected.push({ id, reason: id + ' is not in the evidence registry' });
        else if (owner !== current)
            result.rejected.push({ id, reason: id + ' belongs to ' + owner + (current ? ', not ' + current : '') });
        else
            result.accepted.push(id);
    }
    return result;
}

export function hasCurrentLotEvidence(text: string, options: ValidateOptions = {}) {
    return checkCurrentLotEvidence(text, options).accepted.length > 0;
}

export function validateRootCause(text: string, retrievedIds: readonly string[], options: ValidateOptions = {}): ValidationResult {
    const issues: ValidationIssue[] = [];
    const retrieved = new Set(retrievedIds.map(id => id.toUpperCase()));
    const current = options.currentNcrId?.toUpperCase();
    const cited = citedNcrIds(text).filter(id => id !== current);

    // Rule A
    for (const id of cited.filter(id => !retrieved.has(id)))
        issues.push({ code: 'CITATION_NOT_RETRIEVED', message: id + ' is cited but was not retrieved for this case. Cite only retrieved historical NCRs.' });

    // Rule B
    const generic = genericPhrasesIn(text);
    if (generic.length) {
        const citesRetrieved = cited.some(id => retrieved.has(id));
        const evidence = checkCurrentLotEvidence(text, options);
        const hasEvidence = evidence.accepted.length > 0;
        if (!citesRetrieved || !hasEvidence) {
            const example = options.evidenceRegistry ? options.evidenceRegistry.find(r => r.ncrId.toUpperCase() === current)?.id : 'TR-104';
            const evidenceNeed = 'a current-lot evidence id' + (options.evidenceRegistry ? ' registered to this NCR' : '') + (example ? ' such as ' + example : '') + (evidence.rejected.length ? ' (' + evidence.rejected.map(r => r.reason).join('; ') + ')' : '');
            const missing = [!citesRetrieved && 'a cited retrieved NCR', !hasEvidence && evidenceNeed].filter(Boolean).join(' and ');
            issues.push({ code: 'GENERIC_CLAIM_UNSUPPORTED', message: 'Generic claim "' + generic.join('", "') + '" needs ' + missing + '. Otherwise state "evidence missing".' });
        }
    }

    // Rule C
    if (retrieved.size === 0) {
        const statesMissing = MISSING_EVIDENCE_STATEMENTS.some(r => r.test(text));
        const asserts = ROOT_CAUSE_ASSERTIONS.some(r => r.test(text));
        if (!statesMissing || asserts)
            issues.push({ code: 'ROOT_CAUSE_WITHOUT_EVIDENCE', message: ['No historical evidence was retrieved.', asserts && 'Do not assert a root cause.', !statesMissing && 'State that evidence is missing.'].filter(Boolean).join(' ') });
    }

    // Rule D
    let hypothesisStatus: HypothesisStatus | undefined;
    if (options.evidenceRegistry && current) {
        const hasCurrentLot = options.evidenceRegistry.some(r => r.ncrId.toUpperCase() === current);
        hypothesisStatus = hasCurrentLot ? 'evidence_registered' : 'unverified_hypothesis';
        if (!hasCurrentLot) {
            if (CLAIMED_CONFIRMED.some(r => r.test(text)))
                issues.push({ code: 'ROOT_CAUSE_CLAIMED_CONFIRMED', message: 'No current-lot evidence is registered for ' + current + ', so the root cause is an unverified hypothesis and must not be stated as confirmed.' });
            if (options.missingData && options.missingData.length === 0)
                issues.push({ code: 'MISSING_DATA_REQUIRED', message: 'No current-lot evidence is registered for ' + current + '. List the missing data needed to verify the hypothesis.' });
        }
    }

    return hypothesisStatus ? { ok: issues.length === 0, issues, hypothesisStatus } : { ok: issues.length === 0, issues };
}
