# Standalone compliance logic — importable by the router and the seed script.
import re
from sqlalchemy.orm import Session
from models import CanvasState, ComplianceRule

REQUIRED_LOCKED_TYPES = {"isi", "footer"}


def run_checks(canvas: CanvasState, db: Session) -> dict:
    blocks = canvas.blocks_json or []
    rules = db.query(ComplianceRule).all()
    checks = []
    overall = "pass"

    # Unverified free blocks with text
    unverified = [
        b for b in blocks
        if not b.get("locked")
        and b.get("compliance_status") != "verified"
        and b.get("content", {}).get("text")
    ]
    if unverified:
        checks.append({
            "rule": "unverified_claims",
            "description": f"{len(unverified)} block(s) contain human-written text — ensure medical review before sending",
            "severity": "warning",
            "block_ids": [b["id"] for b in unverified],
        })
        if overall == "pass":
            overall = "warn"

    # Prohibited words — only scan human-written (unverified) blocks
    human_text = " ".join(
        b.get("content", {}).get("text", "")
        for b in blocks
        if b.get("compliance_status") != "verified"
    ).lower()
    for rule in rules:
        if rule.rule_type == "prohibited_word" and rule.pattern:
            if re.search(r"\b" + re.escape(rule.pattern.lower()) + r"\b", human_text):
                checks.append({
                    "rule": "prohibited_word",
                    "description": rule.description,
                    "severity": rule.severity,
                })
                if rule.severity == "error":
                    overall = "fail"
                elif overall == "pass":
                    overall = "warn"

    # Required sections
    present = {b["type"] for b in blocks if b.get("locked")}
    missing = REQUIRED_LOCKED_TYPES - present
    if missing:
        checks.append({
            "rule": "missing_required_section",
            "description": f"Missing required sections: {', '.join(sorted(missing))}",
            "severity": "error",
        })
        overall = "fail"

    return {
        "overall": overall,
        "checks": checks,
        "can_export": overall != "fail",
    }
