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
| `SAP_HUB_API_KEY_FILE` | none | Optional. Path to a text file outside the repo containing only the SAP Business Accelerator Hub API key. Read at call time, sent as the `APIKey` header. |
| `SAP_HUB_BASE_URL` | none | Optional. SAP Business Accelerator Hub sandbox host. |
| `SAP_HUB_SERVICE_PATH` | none | Optional. Path of the QM service on the sandbox (not chosen yet). |

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

Rejection paths, same environment: `.\.venv\Scripts\python scripts\smoke_sap_rejections.py`. It runs (a) NCR-2026-100 without current-lot evidence and (b) an engineer note pushing "operator human error", prints each agent response unchanged followed by an `EXPECTATION MET` / `NOT MET` line, and exits 0 only if both are met.

## SAP QM context (Business Accelerator Hub sandbox)

Tool `get_sap_quality_context` is called by the service once per D4 request in every mode, before the engine runs; it is not a model tool, so the timeline entry does not depend on the model choosing to call it. The result goes to the engine as `sap_context` and into the model prompt as background, marked "PLACEHOLDER content, not SAP data" while `placeholder` is true. It returns read-only SAP QM context labelled "SAP sandbox sample data (not current-lot evidence)", from `quality_agent/sap_hub.py`. With all three `SAP_HUB_*` variables set, it sends `GET <SAP_HUB_BASE_URL>/<SAP_HUB_SERVICE_PATH>?$top=5` with the `APIKey` header and keeps the scalar fields of up to five rows (`d.results` or `value`). Without the variables, or on a network, HTTP or parse error, it returns `fixtures/sap_quality_context.json` with source "cached sample" and the reason. Each `sap_context` entry in the response has `tool`, `label`, `source` and `placeholder`; the UI timeline says "Content is a placeholder, not SAP data" unless the source is `live sandbox` and `placeholder` is false. That fixture is a PLACEHOLDER until the QM API and its spec are chosen. TODO(verify): service path, header and paging option for the chosen API.

The result is never current-lot evidence: the tool records only its source in the response (`sap_context`), adds no NCR id to `retrieved` and nothing to the evidence registry, so it cannot unlock D4, and validator Rule F rejects a proposal that uses sandbox data as evidence or confirmation. The workspace timeline shows each call with its source.

## Bedrock readiness check

`scripts/check_bedrock.py` runs one D4 proposal with `AGENT_MODE=bedrock` through the default AWS credential chain and prints one line, `OUTCOME: ok | no_credentials | access_denied | model_not_enabled | other`, with the exception type and AWS error code on failure. It never reads, prints or passes credentials and never prints error messages. It calls AWS for real and is not part of any test suite (only its classifier is unit tested).

```powershell
cd agent
$env:AGENT_MODEL_ID = '<Bedrock model id or inference profile id>'
$env:AWS_REGION = 'us-west-2'
.\.venv\Scripts\python scripts\check_bedrock.py
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
