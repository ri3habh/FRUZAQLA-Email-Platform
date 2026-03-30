from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import ApprovedClaim, BrandConfig, CanvasState, ContentProject, ContentTemplate, ContentVersion, EditEvent
from services.html_renderer import render_email
from services.compliance_engine import run_checks

router = APIRouter(prefix="/api")


class CreateProjectRequest(BaseModel):
    title: str
    content_type: str = "email"
    audience: str = ""
    tone: str = "clinical"


class SnapshotRequest(BaseModel):
    label: str = ""
    created_by: str = "Anonymous"


class RenameProjectRequest(BaseModel):
    title: str


@router.get("/projects")
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(ContentProject).order_by(ContentProject.created_at.desc()).all()
    result = []
    for p in projects:
        # Latest compliance from most recent exported version
        last_version = (
            db.query(ContentVersion)
            .filter_by(project_id=p.id)
            .order_by(ContentVersion.version_number.desc())
            .first()
        )
        compliance = last_version.compliance_status if last_version else None

        # First 2 unlocked text blocks for preview
        canvas = db.query(CanvasState).filter_by(project_id=p.id).first()
        preview_blocks = []
        if canvas and canvas.blocks_json:
            for b in sorted(canvas.blocks_json, key=lambda x: x.get("order", 0)):
                if not b.get("locked") and b.get("type") == "free_text":
                    text = b.get("content", {}).get("text", "").strip()
                    if text:
                        preview_blocks.append(text[:120])
                    if len(preview_blocks) >= 2:
                        break

        result.append({
            "id": p.id,
            "title": p.title,
            "content_type": p.content_type,
            "audience": p.audience,
            "status": p.status,
            "created_at": p.created_at.isoformat(),
            "compliance": compliance,
            "preview_blocks": preview_blocks,
        })
    return result


@router.post("/projects")
def create_project(body: CreateProjectRequest, db: Session = Depends(get_db)):
    project = ContentProject(
        title=body.title,
        content_type=body.content_type,
        audience=body.audience,
        tone=body.tone,
    )
    db.add(project)
    db.flush()

    canvas = _hydrate_canvas(project, db)
    db.add(canvas)
    db.commit()

    return {"project_id": project.id}


@router.get("/projects/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.get(ContentProject, project_id)
    if not project:
        raise HTTPException(404)
    return {
        "id": project.id,
        "title": project.title,
        "content_type": project.content_type,
        "audience": project.audience,
        "tone": project.tone,
        "status": project.status,
    }


@router.patch("/projects/{project_id}")
def rename_project(project_id: str, body: RenameProjectRequest, db: Session = Depends(get_db)):
    project = db.get(ContentProject, project_id)
    if not project:
        raise HTTPException(404)
    project.title = body.title.strip()
    db.commit()
    return {"ok": True}


@router.delete("/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.get(ContentProject, project_id)
    if not project:
        raise HTTPException(404)
    db.delete(project)
    db.commit()
    return {"ok": True}


@router.get("/projects/{project_id}/canvas")
def get_canvas(project_id: str, db: Session = Depends(get_db)):
    canvas = db.query(CanvasState).filter(
        CanvasState.project_id == project_id
    ).first()
    if not canvas:
        raise HTTPException(404, "Canvas not found")
    return {
        "project_id": project_id,
        "blocks": canvas.blocks_json,
        "brand_tokens": canvas.brand_tokens,
        "updated_at": canvas.updated_at.isoformat(),
    }


@router.put("/projects/{project_id}/canvas")
def update_canvas(project_id: str, body: dict, db: Session = Depends(get_db)):
    canvas = db.query(CanvasState).filter(
        CanvasState.project_id == project_id
    ).first()
    if not canvas:
        raise HTTPException(404)
    canvas.blocks_json = body.get("blocks", canvas.blocks_json)
    canvas.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


# ── Export ───────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/export")
def export_project(project_id: str, db: Session = Depends(get_db)):
    project = db.get(ContentProject, project_id)
    if not project:
        raise HTTPException(404)

    canvas = db.query(CanvasState).filter(
        CanvasState.project_id == project_id
    ).first()
    if not canvas:
        raise HTTPException(404, "Canvas not found")

    # Run compliance check — block export if hard failures exist
    report = run_checks(canvas, db)
    if not report["can_export"]:
        raise HTTPException(400, {
            "message": "Compliance check failed — fix errors before exporting",
            "checks": report["checks"],
        })

    html = render_email(
        blocks=canvas.blocks_json,
        brand_tokens=canvas.brand_tokens,
        project_title=project.title,
        compliance_status=report["overall"],
    )

    # Snapshot to ContentVersion for audit trail
    version_number = _next_version_number(project_id, db)
    db.add(ContentVersion(
        project_id=project_id,
        html=html,
        canvas_json=canvas.blocks_json,
        version_number=version_number,
        label="Exported",
        compliance_status=report["overall"],
    ))
    db.add(EditEvent(
        project_id=project_id,
        action="export",
        description=f"Exported v{version_number}",
    ))
    db.commit()

    filename = project.title.replace(" ", "_").lower() + f"_v{version_number}.html"
    return HTMLResponse(
        content=html,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Version history ──────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/versions")
def list_versions(project_id: str, db: Session = Depends(get_db)):
    versions = (
        db.query(ContentVersion)
        .filter_by(project_id=project_id)
        .order_by(ContentVersion.version_number.desc())
        .all()
    )
    return [
        {
            "id": v.id,
            "version_number": v.version_number,
            "label": v.label or "",
            "created_by": v.created_by or "Unknown",
            "compliance_status": v.compliance_status or "unknown",
            "created_at": v.created_at.isoformat(),
            "has_canvas": v.canvas_json is not None,
        }
        for v in versions
    ]


@router.post("/projects/{project_id}/snapshot")
def save_snapshot(project_id: str, body: SnapshotRequest, db: Session = Depends(get_db)):
    canvas = db.query(CanvasState).filter_by(project_id=project_id).first()
    if not canvas:
        raise HTTPException(404, "Canvas not found")

    version_number = _next_version_number(project_id, db)
    db.add(ContentVersion(
        project_id=project_id,
        canvas_json=canvas.blocks_json,
        version_number=version_number,
        label=body.label or "Manual snapshot",
        created_by=body.created_by,
    ))
    db.add(EditEvent(
        project_id=project_id,
        user_name=body.created_by,
        action="snapshot",
        description=f"Saved v{version_number}: {body.label or 'Manual snapshot'}",
    ))
    db.commit()
    return {"version_number": version_number}


@router.post("/projects/{project_id}/versions/{version_id}/restore")
def restore_version(project_id: str, version_id: str, body: SnapshotRequest, db: Session = Depends(get_db)):
    version = db.query(ContentVersion).filter_by(id=version_id, project_id=project_id).first()
    if not version:
        raise HTTPException(404, "Version not found")
    if not version.canvas_json:
        raise HTTPException(400, "This version has no canvas snapshot to restore from")

    canvas = db.query(CanvasState).filter_by(project_id=project_id).first()
    if not canvas:
        raise HTTPException(404, "Canvas not found")

    # Snapshot current state before overwriting
    current_version = _next_version_number(project_id, db)
    db.add(ContentVersion(
        project_id=project_id,
        canvas_json=canvas.blocks_json,
        version_number=current_version,
        label=f"Auto-saved before restore to v{version.version_number}",
        created_by=body.created_by,
    ))

    canvas.blocks_json = version.canvas_json
    canvas.updated_at = datetime.utcnow()

    db.add(EditEvent(
        project_id=project_id,
        user_name=body.created_by,
        action="restore",
        description=f"Restored to v{version.version_number}: {version.label or ''}",
    ))
    db.commit()
    return {"ok": True, "restored_version": version.version_number}


@router.get("/projects/{project_id}/activity")
def get_activity(project_id: str, limit: int = 20, db: Session = Depends(get_db)):
    events = (
        db.query(EditEvent)
        .filter_by(project_id=project_id)
        .order_by(EditEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": e.id,
            "action": e.action,
            "description": e.description,
            "user_name": e.user_name or "Unknown",
            "created_at": e.created_at.isoformat(),
        }
        for e in events
    ]


# ── Canvas hydration ─────────────────────────────────────────────────────────

def _hydrate_canvas(project: ContentProject, db: Session) -> CanvasState:
    template = db.query(ContentTemplate).filter(
        ContentTemplate.content_type == project.content_type
    ).first()

    brand_config = (
        db.query(BrandConfig).order_by(BrandConfig.created_at.desc()).first()
    )

    if template:
        blocks = _blocks_from_template(template.sections_json, db)
    else:
        blocks = [_empty_free_block(order=10)]

    return CanvasState(
        project_id=project.id,
        blocks_json=blocks,
        brand_tokens=brand_config.tokens_json if brand_config else {},
    )


def _blocks_from_template(sections: list, db: Session) -> list:
    blocks = []
    for section in sorted(sections, key=lambda s: s.get("order", 0)):
        block = {
            "id": str(uuid4()),
            "type": section["type"],
            "locked": section.get("locked", False),
            "order": section["order"],
            "compliance_status": "verified" if section.get("locked") else "unverified",
            "content": {},
            "source": None,
        }

        if section.get("locked") and section.get("boilerplate_category"):
            claim = db.query(ApprovedClaim).filter(
                ApprovedClaim.category == section["boilerplate_category"]
            ).first()
            if claim:
                block["content"]["text"] = claim.text
                block["content"]["claim_id"] = claim.id
                block["source"] = {
                    "document": claim.source_document,
                    "page": claim.source_page,
                }

        blocks.append(block)
    return blocks


def _empty_free_block(order: int) -> dict:
    return {
        "id": str(uuid4()),
        "type": "free_text",
        "locked": False,
        "order": order,
        "compliance_status": "unverified",
        "content": {},
        "source": None,
    }


def _next_version_number(project_id: str, db: Session) -> int:
    last = (
        db.query(ContentVersion)
        .filter_by(project_id=project_id)
        .order_by(ContentVersion.version_number.desc())
        .first()
    )
    return (last.version_number + 1) if last else 1
