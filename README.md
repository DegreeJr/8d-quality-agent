# 8D Quality Agent

Enterprise manufacturing quality frontend for the AWS Agentic AI Hackathon / Intelligent Manufacturing track.

## Run locally

Requires Node.js 20.9 or newer and npm.

```powershell
cd "C:\Kuliahhh\Project Lomba AWS"
npm install
npm run dev
```

Open http://localhost:3000.

## Checks and production

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

## Demo walkthrough

1. Dashboard: view connected record counts, trends, and agent activity. Chart period toggles between three and six months; historical chart series are synthetic.
2. NCR Management: search and filter records, inspect details, or create a new text-based NCR. Attach a PDF, TXT, or DOCX up to 10 MB to simulate an upload. Only its filename is retained; file contents are not uploaded or parsed.
3. AI 8D Workspace: start with NCR-2026-104 at D4. Review historical cases; save your engineering findings. Record objective validation evidence when explicitly approving D4. Generate and review D5, then explicitly approve it to unlock D6. Rejecting or editing a discipline invalidates downstream approvals. Save editor changes before approving.
4. CAPA Monitoring: assign actions to engineers, filter overdue actions, and update statuses. Finish linked actions before closing D8.
5. Knowledge Base: inspect synthetic historical causes, corrective actions, and evidence references. References are metadata, not attached files.
6. Audit Trail: review AI, human, and system events. Export filtered events as JSON.

Use the profile menu to reset the browser-local demo data. State persists in localStorage under `8d-quality-agent-v1`. All AI generation and assistant replies use deterministic synthetic suggestions with short simulated processing delays. No model, AWS service, authentication, or production backend is connected.

## Structure

- `src/app`: six Next.js App Router pages and shared styling.
- `src/components`: layout, shared tables, provider, and shadcn-style Button and Radix Dialog primitives.
- `src/lib/types.ts`: domain contracts.
- `src/lib/data.ts`: connected synthetic cases and draft generation.
- `src/lib/workflow.ts`: approval gates and business validation.
- `tests/workflow.test.ts`: approval and entity-integrity checks.

For API integration, replace provider mutations with an API-backed repository while retaining domain types and workflow validation. Human approvals must eventually be enforced by a backend with authenticated identities, immutable audit storage, and objective evidence records.

Overdue labels compare action due dates with today's date. The seed dataset represents an October 2026 demo snapshot.
"# 8d-quality-agent" 
