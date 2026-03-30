import json
import os
from datetime import datetime

import anthropic
from sqlalchemy.orm import Session

from models import ApprovedClaim, BrandConfig, ComplianceRule, SourceDocument
from services.pdf_parser import extract_pages

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

STYLE_PROMPT = """\
You are extracting brand and compliance rules from a pharmaceutical marketing \
style guide. Return ONLY valid JSON — no prose, no markdown fences.

Extract exactly these keys:
{{
  "brand_tokens": {{
    "primary_color": "#hex",
    "secondary_color": "#hex",
    "font_family": "string",
    "email_max_width": "600px"
  }},
  "required_sections": [
    {{"name": "string", "order": 0, "locked": true, "required": true,
      "boilerplate_category": "string or null"}}
  ],
  "boilerplate_language": [
    {{"placement": "email_closing|isi_header|footer|...", "exact_text": "string"}}
  ],
  "prohibited_words": ["string"],
  "structural_rules": [
    {{"description": "string", "severity": "error|warning"}}
  ]
}}

Style guide text:
{text}"""


def extract_style_guide(path: str, doc: SourceDocument, db: Session) -> dict:
    pages = extract_pages(path)
    full_text = "\n\n".join(
        chunk for page in pages for chunk in page["chunks"]
    )

    data = _call_claude(full_text)
    if not data:
        raise ValueError("Claude returned unparseable style guide output")

    _save_brand_config(data, doc, db)
    _save_compliance_rules(data, doc, db)
    boilerplate_count = _save_boilerplate_claims(data, doc, db)

    db.flush()

    return {
        "brand_tokens_saved": bool(data.get("brand_tokens")),
        "compliance_rules_saved": (
            len(data.get("structural_rules", []))
            + len(data.get("prohibited_words", []))
        ),
        "boilerplate_claims_saved": boilerplate_count,
    }


def _save_brand_config(data: dict, doc: SourceDocument, db: Session) -> None:
    db.add(BrandConfig(
        source_doc_id=doc.id,
        tokens_json=data.get("brand_tokens", {}),
        created_at=datetime.utcnow(),
    ))


def _save_compliance_rules(data: dict, doc: SourceDocument, db: Session) -> None:
    for rule in data.get("structural_rules", []):
        db.add(ComplianceRule(
            source_doc_id=doc.id,
            rule_type="structural",
            description=rule["description"],
            pattern=None,
            severity=rule.get("severity", "warning"),
            created_at=datetime.utcnow(),
        ))

    for word in data.get("prohibited_words", []):
        db.add(ComplianceRule(
            source_doc_id=doc.id,
            rule_type="prohibited_word",
            description=f'Prohibited word or phrase: "{word}"',
            pattern=word,
            severity="warning",
            created_at=datetime.utcnow(),
        ))


def _save_boilerplate_claims(data: dict, doc: SourceDocument, db: Session) -> int:
    items = data.get("boilerplate_language", [])
    for item in items:
        db.add(ApprovedClaim(
            text=item["exact_text"],
            category="boilerplate",
            source_document=doc.filename,
            source_page=None,
            created_at=datetime.utcnow(),
        ))
    return len(items)


def _call_claude(text: str) -> dict | None:
    # Truncate input so the full JSON response fits within the token budget
    truncated = text[:12000]
    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            messages=[{"role": "user", "content": STYLE_PROMPT.format(text=truncated)}],
        )
        raw = message.content[0].text.strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.rsplit("```", 1)[0].strip()

        return json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"    style_extractor parse error: {exc}")
        print(f"    raw output (last 300 chars): ...{raw[-300:]}")
        return None
    except Exception as exc:
        print(f"    style_extractor error: {exc}")
        return None
