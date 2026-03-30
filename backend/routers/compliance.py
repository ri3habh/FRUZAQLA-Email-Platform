import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import CanvasState
from services.compliance_engine import run_checks

router = APIRouter(prefix="/api")


@router.post("/compliance/{project_id}/check")
def check_compliance(project_id: str, db: Session = Depends(get_db)):
    canvas = db.query(CanvasState).filter(
        CanvasState.project_id == project_id
    ).first()
    if not canvas:
        raise HTTPException(404)

    report = run_checks(canvas, db)
    report["project_id"] = project_id
    return report
