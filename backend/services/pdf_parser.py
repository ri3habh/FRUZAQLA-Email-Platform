import pdfplumber


def extract_pages(path: str) -> list[dict]:
    """
    Returns [{page_num, chunks}] where chunks are paragraph-level text blocks.
    Page numbers are preserved for source attribution.
    """
    pages = []

    with pdfplumber.open(path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            text = page.extract_text()
            if not text:
                continue

            chunks = _chunk_by_paragraph(text)
            chunks = [c for c in chunks if len(c.strip()) >= 60]

            if chunks:
                pages.append({"page_num": page_num, "chunks": chunks})

    return pages


def _chunk_by_paragraph(text: str) -> list[str]:
    # Double newline = paragraph break for most PDFs.
    # Fall back to single newline for tightly-formatted docs (prescribing info).
    paragraphs = [p.strip() for p in text.split("\n\n")]
    if len(paragraphs) <= 2:
        paragraphs = [p.strip() for p in text.split("\n")]
    return [p for p in paragraphs if p]
