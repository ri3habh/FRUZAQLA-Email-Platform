from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import ApprovedClaim, VisualAsset

router = APIRouter(prefix="/api")


@router.get("/claims")
def list_approved_claims(
    category: str | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(ApprovedClaim).filter(
        ApprovedClaim.category != "boilerplate"     # boilerplate is internal only
    )
    if category:
        q = q.filter(ApprovedClaim.category == category)
    if search:
        q = q.filter(ApprovedClaim.text.ilike(f"%{search}%"))

    claims = q.order_by(ApprovedClaim.category, ApprovedClaim.created_at).all()
    return [
        {
            "id": c.id,
            "text": c.text,
            "category": c.category,
            "source_document": c.source_document,
            "source_page": c.source_page,
        }
        for c in claims
    ]


@router.get("/assets")
def list_assets(
    asset_type: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(VisualAsset)
    if asset_type:
        q = q.filter(VisualAsset.asset_type == asset_type)
    assets = q.order_by(VisualAsset.asset_type, VisualAsset.filename).all()
    return [
        {
            "id": a.id,
            "filename": a.filename,
            "url": a.url,
            "asset_type": a.asset_type,
            "description": a.description,
            "tags": a.tags,
        }
        for a in assets
    ]


@router.get("/claims/{claim_id}")
def get_claim(claim_id: str, db: Session = Depends(get_db)):
    claim = db.get(ApprovedClaim, claim_id)
    if not claim:
        from fastapi import HTTPException
        raise HTTPException(404)
    return {
        "id": claim.id,
        "text": claim.text,
        "category": claim.category,
        "source_document": claim.source_document,
        "source_page": claim.source_page,
    }
