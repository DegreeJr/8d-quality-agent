# Quality agent (Python)

Strands agent with two tools, `search_similar_ncr(description)` and `get_ncr(ncr_id)`, over the corpus in `../data/`. Its output is `{root_cause, cited_ncr_ids, confidence (low|medium|high), missing_data}`, checked by `quality_agent/validator.py` (a port of `src/lib/validator.ts`, same fixture). Citations are checked against the ids the tools actually returned in that invocation.

The HTTP entry point follows the AgentCore Runtime HTTP contract: `POST /invocations`, `GET /ping`, port 8080 (`BedrockAgentCoreApp` from `bedrock-agentcore`).

## Setup and run

```powershell
cd agent
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m pytest
.\.venv\Scripts\python -m quality_agent.app        # mock mode on http://127.0.0.1:8080
```

Then run the UI against it from the repo root:

```powershell
$env:NEXT_PUBLIC_AGENT_BACKEND='local'; $env:AGENT_URL='http://127.0.0.1:8080'; npm run dev
```

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `AGENT_MODE` | `mock` | `mock` (no model, no AWS), `bedrock` (Strands + Amazon Bedrock). `sap` is planned and raises NotImplementedError. |
| `AGENT_MODEL_ID` | none | Required for `bedrock`. No model id is hard-coded. |
| `AWS_REGION` | `us-west-2` | Region for Bedrock. |
| `AGENT_DATA_DIR` | `../data` | Corpus and evidence registry location. |
| `PORT` | `8080` | Local port. |

Credentials: the bedrock mode uses the default AWS credential chain through boto3. Nothing in this folder reads, accepts or logs credentials. Tests block AWS client creation and API calls.

## Adding a provider (for example SAP AI Core)

`engines.py` defines an `Engine` protocol. Either add a factory to `MODEL_FACTORIES` that returns a Strands `Model`, or implement `Engine` directly. The service, tools and validator do not change.

## Request and response

```json
{ "action": "propose_root_cause",
  "ncr": { "id": "NCR-2026-104", "title": "...", "description": "...", "area": "Die casting" },
  "current_evidence": [{ "id": "TR-104", "ncrId": "NCR-2026-104" }] }
```

The mock response for NCR-2026-104 is in `../tests/fixtures/agent-response-mock-104.json`. When the check rejects a proposal, `accepted` is false, `proposal.root_cause` is null, `missing_data` says evidence is missing, and the model output is kept in `raw_proposal` for audit.
