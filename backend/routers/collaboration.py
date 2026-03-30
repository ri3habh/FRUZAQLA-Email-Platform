"""
Block-level comments and activity feed for canvas collaboration.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import BlockComment, ContentProject, EditEvent

router = APIRouter(prefix="/api")


class AddCommentRequest(BaseModel):
    block_id: str | None = None   # None = general project comment
    author: str
    text: str


# ── Comments ──────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/comments")
def list_comments(project_id: str, block_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(BlockComment).filter_by(project_id=project_id)
    if block_id:
        q = q.filter_by(block_id=block_id)
    comments = q.order_by(BlockComment.created_at.asc()).all()
    return [_serialize_comment(c) for c in comments]


@router.post("/projects/{project_id}/comments")
def add_comment(project_id: str, body: AddCommentRequest, db: Session = Depends(get_db)):
    if not db.get(ContentProject, project_id):
        raise HTTPException(404, "Project not found")

    comment = BlockComment(
        project_id=project_id,
        block_id=body.block_id,
        author=body.author,
        text=body.text,
    )
    db.add(comment)
    db.add(EditEvent(
        project_id=project_id,
        user_name=body.author,
        action="comment",
        description=f"Commented on {'block ' + body.block_id[:8] if body.block_id else 'project'}",
    ))
    db.commit()
    db.refresh(comment)
    return _serialize_comment(comment)


@router.patch("/projects/{project_id}/comments/{comment_id}/resolve")
def resolve_comment(project_id: str, comment_id: str, db: Session = Depends(get_db)):
    comment = db.query(BlockComment).filter_by(id=comment_id, project_id=project_id).first()
    if not comment:
        raise HTTPException(404, "Comment not found")
    comment.resolved = not comment.resolved
    db.commit()
    return _serialize_comment(comment)


@router.delete("/projects/{project_id}/comments/{comment_id}")
def delete_comment(project_id: str, comment_id: str, db: Session = Depends(get_db)):
    comment = db.query(BlockComment).filter_by(id=comment_id, project_id=project_id).first()
    if not comment:
        raise HTTPException(404, "Comment not found")
    db.delete(comment)
    db.commit()
    return {"ok": True}


def _serialize_comment(c: BlockComment) -> dict:
    return {
        "id": c.id,
        "project_id": c.project_id,
        "block_id": c.block_id,
        "author": c.author,
        "text": c.text,
        "resolved": c.resolved,
        "created_at": c.created_at.isoformat(),
    }
