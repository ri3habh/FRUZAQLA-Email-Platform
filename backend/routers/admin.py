import os
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from models import ApprovedClaim, CandidateClaim, SourceDocument
from services.claim_extractor import extract_claims
from services.style_extractor import extract_style_guide

router = APIRouter(prefix="/admin")

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ── Document ingestion ───────────────────────────────────────────────────────

@router.post("/documents/ingest")
async def ingest_document(
    file: UploadFile = File(...),
    doc_type: str = Form(...),      # clinical_trial|prescribing_info|style_guide|visual_aid
    db: Session = Depends(get_db),
):
    upload_path = f"{UPLOAD_DIR}/{uuid4()}_{file.filename}"
    contents = await file.read()
    with open(upload_path, "wb") as f:
        f.write(contents)

    doc = SourceDocument(
        filename=file.filename,
        doc_type=doc_type,
        upload_path=upload_path,
        status="processing",
        uploaded_at=datetime.utcnow(),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    try:
        if doc_type == "style_guide":
            result = extract_style_guide(upload_path, doc, db)
        else:
            result = extract_claims(upload_path, doc, db)

        doc.status = "complete"
        doc.processed_at = datetime.utcnow()
        doc.candidate_count = result.get("candidate_count", 0)

    except Exception as e:
        doc.status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))

    db.commit()
    return {"doc_id": str(doc.id), "doc_type": doc_type, **result}


@router.get("/documents")
def list_documents(db: Session = Depends(get_db)):
    docs = db.query(SourceDocument).order_by(SourceDocument.uploaded_at.desc()).all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "doc_type": d.doc_type,
            "status": d.status,
            "candidate_count": d.candidate_count,
            "approved_count": d.approved_count,
            "rejected_count": d.rejected_count,
            "uploaded_at": d.uploaded_at.isoformat(),
        }
        for d in docs
    ]


# ── Claim review queue ───────────────────────────────────────────────────────

@router.get("/claims/queue")
def get_claim_queue(
    doc_id: str | None = None,
    category: str | None = None,
    min_confidence: float = 0.0,
    status: str = "pending_review",
    db: Session = Depends(get_db),
):
    q = db.query(CandidateClaim).filter(CandidateClaim.status == status)
    if doc_id:
        q = q.filter(CandidateClaim.source_doc_id == doc_id)
    if category:
        q = q.filter(CandidateClaim.category == category)
    if min_confidence:
        q = q.filter(CandidateClaim.confidence >= min_confidence)

    claims = q.order_by(CandidateClaim.confidence.desc()).all()
    return [_serialize_candidate(c) for c in claims]


# Bulk routes MUST come before /{claim_id} routes — FastAPI matches in order
@router.post("/claims/bulk-approve")
def bulk_approve(body: dict, db: Session = Depends(get_db)):
    ids = body.get("ids", [])
    approved_count = 0
    for claim_id in ids:
        candidate = db.get(CandidateClaim, claim_id)
        if not candidate or candidate.status != "pending_review":
            continue

        approved = ApprovedClaim(
            text=candidate.exact_text,
            category=candidate.category,
            source_document=candidate.source_document,
            source_page=candidate.source_page,
        )
        db.add(approved)
        db.flush()

        candidate.status = "approved"
        candidate.reviewed_at = datetime.utcnow()
        candidate.approved_claim_id = approved.id
        approved_count += 1

    db.commit()
    return {"approved_count": approved_count}


@router.post("/claims/bulk-reject")
def bulk_reject(body: dict, db: Session = Depends(get_db)):
    ids = body.get("ids", [])
    for claim_id in ids:
        candidate = db.get(CandidateClaim, claim_id)
        if candidate:
            candidate.status = "rejected"
            candidate.reviewed_at = datetime.utcnow()
    db.commit()
    return {"rejected_count": len(ids)}


@router.post("/claims/{claim_id}/approve")
def approve_claim(claim_id: str, db: Session = Depends(get_db)):
    candidate = db.get(CandidateClaim, claim_id)
    if not candidate:
        raise HTTPException(404)
    if candidate.status != "pending_review":
        raise HTTPException(400, "Claim is not pending review")

    approved = ApprovedClaim(
        text=candidate.exact_text,
        category=candidate.category,
        source_document=candidate.source_document,
        source_page=candidate.source_page,
    )
    db.add(approved)
    db.flush()

    candidate.status = "approved"
    candidate.reviewed_at = datetime.utcnow()
    candidate.approved_claim_id = approved.id

    doc = db.get(SourceDocument, candidate.source_doc_id)
    if doc:
        doc.approved_count += 1

    db.commit()
    return {"approved_claim_id": str(approved.id)}


@router.post("/claims/{claim_id}/reject")
def reject_claim(claim_id: str, db: Session = Depends(get_db)):
    candidate = db.get(CandidateClaim, claim_id)
    if not candidate:
        raise HTTPException(404)

    candidate.status = "rejected"
    candidate.reviewed_at = datetime.utcnow()

    doc = db.get(SourceDocument, candidate.source_doc_id)
    if doc:
        doc.rejected_count += 1

    db.commit()
    return {"ok": True}


@router.put("/claims/{claim_id}")
def edit_claim(claim_id: str, body: dict, db: Session = Depends(get_db)):
    candidate = db.get(CandidateClaim, claim_id)
    if not candidate:
        raise HTTPException(404)

    candidate.exact_text = body["exact_text"]
    candidate.status = "pending_review"  # re-queue after edit
    db.commit()
    return _serialize_candidate(candidate)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _serialize_candidate(c: CandidateClaim) -> dict:
    return {
        "id": c.id,
        "exact_text": c.exact_text,
        "surrounding_context": c.surrounding_context,
        "category": c.category,
        "confidence": c.confidence,
        "source_document": c.source_document,
        "source_page": c.source_page,
        "status": c.status,
        "source_doc_id": c.source_doc_id,
    }
