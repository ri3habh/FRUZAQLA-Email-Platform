# Solstice — FRUZAQLA® Email Platform

An FDA-compliant pharmaceutical email authoring tool built for the Solstice Full Stack Engineer take-home assignment. Marketers compose promotional emails for FRUZAQLA (fruquintinib) using a canvas of pre-approved clinical claims, locked boilerplate blocks, and brand assets — with compliance checks enforced before every export.

---

## Requirements

- Python 3.11+
- Node 18+
- An Anthropic API key (for claim extraction during seed)

---

## Setup

### 1. Clone and configure

```bash
git clone <repo>
cd Solstice-Demo
```

Create `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Seed the database

The seed script builds the entire DB from the three PDFs in the repo root. It extracts verbatim candidate claims from the Prescribing Information (text-based, via pdfplumber) and Visual Aid (image-based, via Claude Vision), seeds brand tokens, compliance rules, and boilerplate ISI/footer text from the Style Guide.

```bash
# from backend/
python ../seed/seed.py
```

When the seed finishes, visit **http://localhost:3000/admin/claims** and approve the candidate claims you want available in the canvas sidebar. Claims are never auto-approved — every one requires a human decision.

### 4. Run the backend

```bash
# from backend/
uvicorn main:app --reload --port 8000
```

### 5. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**

---

## Using the platform

| Step | Where |
|---|---|
| Create a new email | Click **+** on the dashboard |
| Add content | Type freely in a text block, or focus a block and pick an approved claim from the sidebar |
| Attach brand assets | Hover a block → "Attach image" → pick from the asset grid |
| Add a drawing / signature | Click **✏️ Add drawing** at the bottom of the canvas |
| Check compliance | Toolbar → **Check Compliance** |
| Export | Compliance must pass (or warn only) → **Export HTML** downloads a self-contained file |
| Save a version | Toolbar → **Save version** — creates a named snapshot you can restore later |
| Comment | Hover a block → 💬, or use the Comments tab in the sidebar |
| Admin — ingest new PDFs | http://localhost:3000/admin/documents |
| Admin — review claim queue | http://localhost:3000/admin/claims |

---

## Architecture

```
frontend/          Next.js 14 App Router (TypeScript, Tailwind CSS)
backend/           FastAPI (Python)
  routers/
    projects.py       Canvas CRUD, export, version history
    claims.py         Approved claim library
    compliance.py     Compliance check endpoint
    collaboration.py  Block comments
    admin.py          Document ingestion, claim review queue
  services/
    claim_extractor.py    pdfplumber + Claude text extraction
    vision_extractor.py   PyMuPDF page render + Claude Vision extraction
    compliance_engine.py  Shared compliance rules engine
    html_renderer.py      Canvas → self-contained HTML email
seed/              One-time DB setup script
```

**Database:** SQLite (`backend/solstice.db`) via SQLAlchemy ORM. All tables created automatically on startup.

**API proxy:** Next.js rewrites `/api/*` and `/admin/*` to `http://localhost:8000` — no CORS configuration needed in development.

---

## Key design decisions

### Locked blocks guarantee baseline compliance

The ISI, footer, and header blocks are injected at project creation from the `ContentTemplate` and cannot be edited or deleted. Compliance failures can only originate in the free-text zone — required boilerplate is structurally guaranteed.

### AI is upstream of the canvas, never inline

Claude is used in exactly two places, both during admin ingestion:

1. **Claim extraction** — verbatim-only extraction with explicit instructions against paraphrasing. Output goes into a `CandidateClaim` review queue.
2. **Human review gate** — an admin approves or rejects every candidate before it enters `ApprovedClaim`. The canvas never calls Claude at authoring time.

This prevents hallucinated or paraphrased claims from ever reaching the output HTML.

### Two-mode text blocks

Every unlocked block is either:
- **Verified (green)** — text inserted verbatim from an `ApprovedClaim`, with source document and page number recorded
- **Unverified (yellow)** — human-written connective tissue (salutations, CTAs, transitions)

Unverified blocks produce a compliance *warning* (export allowed, medical review required). Only truly prohibited words or a missing ISI block produce a hard *error* that blocks export. Prohibited word matching uses whole-word regex (`\bsafe\b`) so "safety" in approved clinical text is not flagged. Prohibited word checks only scan unverified blocks.

### Claim lineage is preserved end-to-end

`CandidateClaim` → `ApprovedClaim` → `CanvasBlock.content.claim_id` → HTML comment in the exported file. Every verified sentence in the exported email traces back to a source document and page number.

### Exports are self-contained

The HTML renderer base64-encodes all images (hallmark header, brand icons, drawings) directly into the output file. The exported `.html` renders with no external dependencies — suitable for email client testing or regulatory submission.

### Version history as audit trail

Every export creates a `ContentVersion` snapshot with the full `blocks_json`, compliance status, and timestamp. Manual snapshots can be taken at any time. Any version can be restored — the current state is auto-saved before a restore so nothing is ever lost.

---

## Extending to production

| Concern | Approach |
|---|---|
| Auth | Add JWT middleware; `ContentProject.user_id` FK is already in the schema |
| Real-time collaboration | Replace HTTP PUT canvas save with WebSocket broadcasting block diffs; FastAPI supports this natively |
| Database | Swap SQLite for PostgreSQL — SQLAlchemy ORM is DB-agnostic |
| Approval workflow | Add `review_status` to `ContentProject` and gate export behind approver sign-off |
| Semantic claim search | Embed `ApprovedClaim.text` with `text-embedding-3-small` and surface contextually relevant claims as the marketer types |
| Email delivery | Pass the exported HTML directly to SendGrid or AWS SES |
