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
| `AGENT_MODE` | `mock` | `mock` (no model, no network), `bedrock` (Strands + Amazon Bedrock), `sap` (Strands + SAP AI Core). |
| `AGENT_MODEL_ID` | none | Required for `bedrock`. No model id is hard-coded. |
| `AWS_REGION` | `us-west-2` | Region for Bedrock. |
| `AGENT_DATA_DIR` | `../data` | Corpus and evidence registry location. |
| `PORT` | `8080` | Local port. |
| `SAP_AICORE_KEY_FILE` | none | Required for `sap`. Path to the service key JSON outside the repo. Read at runtime only. |
| `SAP_DEPLOYMENT_ID` | none | Required for `sap`. No default. |
| `SAP_MODEL_NAME` | none | Optional label and request `model` field, e.g. `gpt-5.4`. `anthropic--*` is refused for now. |
| `SAP_RESOURCE_GROUP` | `default` | Sent as the `AI-Resource-Group` header. |
| `SAP_API_VERSION` | `2024-12-01-preview` | `api-version` query parameter. |

Credentials: the bedrock mode uses the default AWS credential chain through boto3. The sap mode reads `clientid`, `clientsecret`, `url` and `serviceurls.AI_API_URL` from the key file when the first model is created, gets a client-credentials token from `<url>/oauth/token`, and keeps it in memory. Key values and tokens are never logged, printed or put in error messages; errors from the model provider are reported by exception type only. Tests block AWS client creation and API calls, and SAP tests use fake keys and mocked HTTP.

## SAP AI Core

`AGENT_MODE=sap` uses the Strands `OpenAIModel` (needs `openai`, pinned in requirements.txt) against `<AI_API_URL>/v2/inference/deployments/<SAP_DEPLOYMENT_ID>/chat/completions?api-version=...`, non-streaming. Only OpenAI-format deployments such as gpt-5.4 are wired. Anthropic deployments on SAP AI Core use a request format that could not be verified from the SAP AI SDK or LiteLLM docs, so they are refused (TODO(verify) in `sap.py`).

Manual smoke test (calls SAP for real, prints only the agent response; not part of any test suite):

```powershell
cd agent
$env:AGENT_MODE = 'sap'
$env:SAP_AICORE_KEY_FILE = 'C:\path\outside\the\repo\service-key.json'
$env:SAP_DEPLOYMENT_ID = 'd1a82575de60e02a'
$env:SAP_MODEL_NAME = 'gpt-5.4'
.\.venv\Scripts\python scripts\smoke_sap.py
```

## Adding a provider

`engines.py` defines an `Engine` protocol. Either add an entry to `MODEL_PROVIDERS` that returns a `ModelSpec` (model id, model name, factory for a Strands `Model`), or implement `Engine` directly. The service, tools and validator do not change.

## Request and response

```json
{ "action": "propose_root_cause",
  "ncr": { "id": "NCR-2026-104", "title": "...", "description": "...", "area": "Die casting" },
  "current_evidence": [{ "id": "TR-104", "ncrId": "NCR-2026-104" }] }
```

The mock response for NCR-2026-104 is in `../tests/fixtures/agent-response-mock-104.json`. When the check rejects a proposal, `accepted` is false, `proposal.root_cause` is null, `missing_data` says evidence is missing, and the model output is kept in `raw_proposal` for audit.
