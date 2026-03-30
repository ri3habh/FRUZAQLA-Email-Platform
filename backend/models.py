from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, JSON, String, Text,
)
from sqlalchemy.orm import relationship

from database import Base


def _uuid() -> str:
    return str(uuid4())


# ── Core entities ────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id         = Column(String, primary_key=True, default=_uuid)
    email      = Column(String, unique=True, nullable=False)
    name       = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class ContentProject(Base):
    __tablename__ = "content_projects"
    id           = Column(String, primary_key=True, default=_uuid)
    user_id      = Column(String, ForeignKey("users.id"), nullable=True)
    title        = Column(String, nullable=False)
    content_type = Column(String, nullable=False)   # email|banner|social|slide
    audience     = Column(String, default="")
    tone         = Column(String, default="clinical")
    status       = Column(String, default="draft")
    created_at   = Column(DateTime, default=datetime.utcnow)

    canvas_state = relationship("CanvasState", back_populates="project", uselist=False)
    versions     = relationship("ContentVersion", back_populates="project")
    edit_events  = relationship("EditEvent", back_populates="project")
    shared_links = relationship("SharedLink", back_populates="project")


# ── Canvas ───────────────────────────────────────────────────────────────────

class CanvasState(Base):
    __tablename__ = "canvas_states"
    id           = Column(String, primary_key=True, default=_uuid)
    project_id   = Column(String, ForeignKey("content_projects.id"), unique=True)
    blocks_json  = Column(JSON, default=list)
    brand_tokens = Column(JSON, default=dict)
    updated_at   = Column(DateTime, default=datetime.utcnow)

    project = relationship("ContentProject", back_populates="canvas_state")


class EditEvent(Base):
    __tablename__ = "edit_events"
    id          = Column(String, primary_key=True, default=_uuid)
    project_id  = Column(String, ForeignKey("content_projects.id"))
    user_name   = Column(String)
    user_color  = Column(String)
    action      = Column(String)    # add_block|remove_block|edit_text|accept_claim
    block_id    = Column(String)
    description = Column(String)
    created_at  = Column(DateTime, default=datetime.utcnow)

    project = relationship("ContentProject", back_populates="edit_events")


# ── Audit / export ───────────────────────────────────────────────────────────

class ContentVersion(Base):
    __tablename__ = "content_versions"
    id             = Column(String, primary_key=True, default=_uuid)
    project_id     = Column(String, ForeignKey("content_projects.id"))
    html           = Column(Text)
    canvas_json    = Column(JSON, default=list)   # snapshot of blocks at save time
    version_number = Column(Integer)
    label          = Column(String, nullable=True)  # human label e.g. "Sent for review"
    created_by     = Column(String, nullable=True)  # author name
    compliance_status = Column(String, nullable=True)  # pass|warn|fail at time of snapshot
    created_at     = Column(DateTime, default=datetime.utcnow)

    project             = relationship("ContentProject", back_populates="versions")
    compliance_results  = relationship("ComplianceResult", back_populates="version")


class ComplianceResult(Base):
    __tablename__ = "compliance_results"
    id         = Column(String, primary_key=True, default=_uuid)
    version_id = Column(String, ForeignKey("content_versions.id"))
    status     = Column(String)     # pass|warn|fail
    checks_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    version = relationship("ContentVersion", back_populates="compliance_results")


# ── Collaboration ────────────────────────────────────────────────────────────

class SharedLink(Base):
    __tablename__ = "shared_links"
    id         = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("content_projects.id"))
    token      = Column(String, unique=True, default=_uuid)
    permission = Column(String, default="view")     # view|comment|edit
    expires_at = Column(DateTime, nullable=True)

    project  = relationship("ContentProject", back_populates="shared_links")
    comments = relationship("Comment", back_populates="shared_link")


class Comment(Base):
    __tablename__ = "comments"
    id                = Column(String, primary_key=True, default=_uuid)
    shared_link_id    = Column(String, ForeignKey("shared_links.id"))
    parent_comment_id = Column(String, ForeignKey("comments.id"), nullable=True)
    content           = Column(Text)
    author_name       = Column(String)
    created_at        = Column(DateTime, default=datetime.utcnow)

    shared_link = relationship("SharedLink", back_populates="comments")
    replies     = relationship("Comment")


class BlockComment(Base):
    """Direct, block-level comments within a project canvas (no share link required)."""
    __tablename__ = "block_comments"
    id         = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("content_projects.id"))
    block_id   = Column(String, nullable=True)   # None = general project comment
    author     = Column(String, nullable=False)
    text       = Column(Text, nullable=False)
    resolved   = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Reference data ───────────────────────────────────────────────────────────

class ApprovedClaim(Base):
    __tablename__ = "approved_claims"
    id              = Column(String, primary_key=True, default=_uuid)
    text            = Column(Text, nullable=False)
    category        = Column(String)    # efficacy|safety|dosing|mechanism|indication|contraindication|boilerplate
    source_document = Column(String)
    source_page     = Column(Integer, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)


class VisualAsset(Base):
    __tablename__ = "visual_assets"
    id         = Column(String, primary_key=True, default=_uuid)
    filename   = Column(String)
    url        = Column(String)
    asset_type = Column(String)     # photo|graph|icon|chart
    description = Column(String)
    tags       = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Ingestion pipeline ───────────────────────────────────────────────────────

class SourceDocument(Base):
    __tablename__ = "source_documents"
    id              = Column(String, primary_key=True, default=_uuid)
    filename        = Column(String)
    doc_type        = Column(String)    # clinical_trial|prescribing_info|style_guide|visual_aid
    upload_path     = Column(String)
    status          = Column(String, default="pending")  # pending|processing|complete|failed
    candidate_count = Column(Integer, default=0)
    approved_count  = Column(Integer, default=0)
    rejected_count  = Column(Integer, default=0)
    uploaded_by     = Column(String, nullable=True)
    uploaded_at     = Column(DateTime, default=datetime.utcnow)
    processed_at    = Column(DateTime, nullable=True)

    candidates = relationship("CandidateClaim", back_populates="source_doc")


class CandidateClaim(Base):
    __tablename__ = "candidate_claims"
    id                  = Column(String, primary_key=True, default=_uuid)
    source_doc_id       = Column(String, ForeignKey("source_documents.id"))
    exact_text          = Column(Text, nullable=False)
    surrounding_context = Column(Text)
    category            = Column(String)
    confidence          = Column(Float)
    source_document     = Column(String)
    source_page         = Column(Integer, nullable=True)
    status              = Column(String, default="pending_review")  # pending_review|approved|rejected
    reviewed_by         = Column(String, nullable=True)
    reviewed_at         = Column(DateTime, nullable=True)
    approved_claim_id   = Column(String, ForeignKey("approved_claims.id"), nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow)

    source_doc = relationship("SourceDocument", back_populates="candidates")


# ── Style guide config ───────────────────────────────────────────────────────

class BrandConfig(Base):
    __tablename__ = "brand_configs"
    id            = Column(String, primary_key=True, default=_uuid)
    source_doc_id = Column(String, ForeignKey("source_documents.id"), nullable=True)
    tokens_json   = Column(JSON, default=dict)
    created_at    = Column(DateTime, default=datetime.utcnow)


class ComplianceRule(Base):
    __tablename__ = "compliance_rules"
    id            = Column(String, primary_key=True, default=_uuid)
    source_doc_id = Column(String, ForeignKey("source_documents.id"), nullable=True)
    rule_type     = Column(String)  # prohibited_word|required_section|structural|formatting
    description   = Column(String)
    pattern       = Column(String, nullable=True)
    severity      = Column(String, default="warning")   # error|warning
    created_at    = Column(DateTime, default=datetime.utcnow)


class ContentTemplate(Base):
    __tablename__ = "content_templates"
    id           = Column(String, primary_key=True, default=_uuid)
    content_type = Column(String, unique=True)  # email|banner|social|slide
    sections_json = Column(JSON, default=list)
    created_at   = Column(DateTime, default=datetime.utcnow)
