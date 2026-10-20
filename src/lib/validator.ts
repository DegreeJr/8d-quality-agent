// Root cause validator: the agent's signature rule, as pure functions with no side effects.
//
// Rule A (citation integrity): every NCR id in the text (/NCR-\d{4}-\d{3}/, case-insensitive)
//   must be one of the retrieved ids. Otherwise: CITATION_NOT_RETRIEVED.
// Rule B (generic claims): a generic root-cause phrase (English or Indonesian, see GENERIC_PHRASES)
//   is rejected with GENERIC_CLAIM_UNSUPPORTED unless BOTH hold:
//     1. at least one retrieved NCR id is cited in the text, AND
//     2. the text references objective current-lot evidence, defined as an evidence record id
//        PREFIX-NNN where PREFIX is one of EVIDENCE_PREFIXES (for example TR-104 or GR-032).
//   The check is syntactic: it cannot confirm that a cited evidence id really belongs to the
//   current lot. That needs an evidence registry on the backend.
// Rule C (no evidence): when the retrieved set is empty, the text must state that evidence is
//   missing and must not assert a root cause. Otherwise: ROOT_CAUSE_WITHOUT_EVIDENCE.

export type ValidationIssueCode = 'CITATION_NOT_RETRIEVED' | 'GENERIC_CLAIM_UNSUPPORTED' | 'ROOT_CAUSE_WITHOUT_EVIDENCE';

export interface ValidationIssue {
    code: ValidationIssueCode;
    message: string;
}

export interface ValidationResult {
    ok: boolean;
    issues: ValidationIssue[];
}

export interface ValidateOptions {
    // Id of the case under investigation. Mentioning it is not a citation of a precedent.
    currentNcrId?: string;
    // Overrides EVIDENCE_PREFIXES.
    evidencePrefixes?: readonly string[];
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

function escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function citedNcrIds(text: string): string[] {
    return [...new Set((text.match(NCR_ID) ?? []).map(id => id.toUpperCase()))];
}

export function genericPhrasesIn(text: string): string[] {
    return GENERIC_PHRASES.filter(p => new RegExp('\\b' + escapeRegExp(p).replace(/\s+/g, '\\s+') + '\\b', 'i').test(text));
}

export function hasCurrentLotEvidence(text: string, prefixes: readonly string[] = EVIDENCE_PREFIXES) {
    return prefixes.length > 0 && new RegExp('\\b(?:' + prefixes.map(escapeRegExp).join('|') + ')-\\d{3,}\\b', 'i').test(text);
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
        const hasEvidence = hasCurrentLotEvidence(text, options.evidencePrefixes);
        if (!citesRetrieved || !hasEvidence) {
            const missing = [!citesRetrieved && 'a cited retrieved NCR', !hasEvidence && 'a current-lot evidence id such as TR-104'].filter(Boolean).join(' and ');
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

    return { ok: issues.length === 0, issues };
}
