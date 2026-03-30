import base64
import json
import os
from datetime import datetime
from pathlib import Path

import anthropic
from sqlalchemy.orm import Session

from models import CandidateClaim, SourceDocument

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

VISION_PROMPT = """\
You are extracting citable claims from a pharmaceutical marketing slide for an \
FDA-regulated content system.

Rules:
1. Return ONLY verbatim text visible on the slide — never paraphrase or infer
2. Each claim must be independently citable and self-contained (1-2 sentences max)
3. Skip decorative text, page numbers, logos, and legal boilerplate
4. Categories: efficacy | safety | dosing | mechanism | indication | contraindication

Return a JSON array only — no prose, no markdown fences.
If no citable claims exist on this slide, return [].

Schema per item:
{{
  "exact_text": "verbatim text from slide",
  "surrounding_context": "brief description of slide context (chart title, section, etc.)",
  "category": "efficacy|safety|dosing|mechanism|indication|contraindication",
  "confidence": 0.0,
  "reasoning": "one sentence"
}}"""


def extract_claims_from_images(
    image_dir: str,
    doc: SourceDocument,
    db: Session,
) -> dict:
    image_paths = sorted(Path(image_dir).glob("*.png"))
    candidates = []
    seen: set[str] = set()

    for img_path in image_paths:
        page_num = int(img_path.stem.split("_")[-1])
        extracted = _call_claude(img_path, page_num, doc.filename)

        for item in extracted:
            text = item.get("exact_text", "").strip()
            if not text or text in seen:
                continue
            seen.add(text)

            candidate = CandidateClaim(
                source_doc_id=doc.id,
                exact_text=text,
                surrounding_context=item.get("surrounding_context", f"Slide {page_num}"),
                category=item.get("category", "efficacy"),
                confidence=float(item.get("confidence", 0.5)),
                source_document=doc.filename,
                source_page=page_num,
                status="pending_review",
                created_at=datetime.utcnow(),
            )
            db.add(candidate)
            candidates.append(candidate)

        db.flush()

    return {"candidate_count": len(candidates)}


def _call_claude(img_path: Path, page_num: int, doc_title: str) -> list[dict]:
    with open(img_path, "rb") as f:
        img_b64 = base64.standard_b64encode(f.read()).decode()

    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": img_b64,
                        },
                    },
                    {"type": "text", "text": VISION_PROMPT},
                ],
            }],
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.rsplit("```", 1)[0].strip()
        return json.loads(raw)
    except Exception:
        return []
