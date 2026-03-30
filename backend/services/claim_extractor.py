import json
import os
from datetime import datetime

import anthropic
from sqlalchemy.orm import Session

from models import CandidateClaim, SourceDocument
from services.pdf_parser import extract_pages

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

EXTRACTION_PROMPT = """\
You are extracting claims from a pharmaceutical clinical document for an \
FDA-regulated marketing system.

Rules:
1. Return ONLY verbatim quotes — never paraphrase, summarize, or combine sentences
2. Each claim must be independently citable and self-contained (1-2 sentences max)
3. Skip methods, procedures, and statistical footnotes unless they state a result
4. Categories: efficacy | safety | dosing | mechanism | indication | contraindication

Source (page {page_num} of "{doc_title}"):
{chunk}

Return a JSON array only — no prose, no markdown fences.
If no citable claims exist in this passage, return [].

Schema per item:
{{
  "exact_text": "verbatim quote from source",
  "surrounding_context": "2-3 sentences of surrounding text for reviewer context",
  "category": "efficacy|safety|dosing|mechanism|indication|contraindication",
  "confidence": 0.0,
  "reasoning": "one sentence"
}}"""


def extract_claims(path: str, doc: SourceDocument, db: Session) -> dict:
    pages = extract_pages(path)
    candidates = []
    seen: set[str] = set()

    for page in pages:
        for chunk in page["chunks"]:
            extracted = _call_claude(chunk, page["page_num"], doc.filename)

            for item in extracted:
                text = item.get("exact_text", "").strip()
                if not text or text in seen:
                    continue
                seen.add(text)

                candidate = CandidateClaim(
                    source_doc_id=doc.id,
                    exact_text=text,
                    surrounding_context=item.get("surrounding_context", chunk[:500]),
                    category=item.get("category", "efficacy"),
                    confidence=float(item.get("confidence", 0.5)),
                    source_document=doc.filename,
                    source_page=page["page_num"],
                    status="pending_review",
                    created_at=datetime.utcnow(),
                )
                db.add(candidate)
                candidates.append(candidate)

        db.flush()

    return {"candidate_count": len(candidates)}


def _call_claude(chunk: str, page_num: int, doc_title: str) -> list[dict]:
    prompt = EXTRACTION_PROMPT.format(
        page_num=page_num,
        doc_title=doc_title,
        chunk=chunk,
    )
    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
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
