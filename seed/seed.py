"""
Seed the database with:
  - Hardcoded brand config + compliance rules from the FRUZAQLA style guide
  - Hardcoded boilerplate claims (ISI, footer)
  - Claude-extracted candidate claims from the two clinical PDFs

Usage (from repo root):
    cd backend && python ../seed/seed.py
"""

import os
import sys
from datetime import datetime, timezone

def _now():
    return datetime.now(timezone.utc)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/../backend")

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "../backend/.env"))

from database import Base, SessionLocal, engine
from models import ApprovedClaim, BrandConfig, CandidateClaim, ComplianceRule, ContentTemplate, SourceDocument, VisualAsset
from services.claim_extractor import extract_claims
from services.vision_extractor import extract_claims_from_images

Base.metadata.create_all(bind=engine)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# ── Hardcoded brand config (from FRUZAQLA Style Guide) ───────────────────────

BRAND_TOKENS = {
    # Color palette — Pantone values from FRUZAQLA Style Guide p.10
    "primary_color": "#002855",         # Dark navy — Pantone 295 C (primary)
    "secondary_color": "#8C4799",       # Purple — Pantone 258 C (secondary)
    "light_blue": "#59CBE8",            # Light blue — Pantone 305 C (tertiary)
    "green": "#97D700",                 # Green — Pantone 375 C (tertiary)
    "yellow": "#FFC72C",                # Yellow — Pantone 123 C (tertiary)
    "black_80": "#333333",              # 80% black used for body/placebo text
    # Typography — Rubik for print/digital; Arial for emails (email client compatibility)
    "font_family": "Arial, Helvetica, sans-serif",          # email-safe fallback
    "font_family_brand": "'Rubik', sans-serif",             # for canvas UI chrome only
    "font_family_condensed": "'Roboto Condensed', sans-serif",
    # Layout
    "email_max_width": "600px",
    "background_color": "#FFFFFF",
    # ISI block
    "isi_font_size": "9px",
    "isi_color": "#555555",
}

# ── Hardcoded boilerplate claims ──────────────────────────────────────────────

BOILERPLATE_CLAIMS = [
    {
        "placement": "isi",
        "text": (
            "IMPORTANT SAFETY INFORMATION\n\n"
            "FRUZAQLA (fruquintinib) is indicated for the treatment of adult patients with "
            "metastatic colorectal cancer (mCRC) who have been previously treated with "
            "fluoropyrimidine-, oxaliplatin-, and irinotecan-based chemotherapy, an anti-VEGF "
            "therapy, and, if RAS wild-type and medically appropriate, an anti-EGFR therapy.\n\n"
            "CONTRAINDICATIONS: None.\n\n"
            "WARNINGS AND PRECAUTIONS: Hypertension — Monitor blood pressure prior to initiating "
            "and during treatment. Withhold, reduce dose, or permanently discontinue based on "
            "severity. Proteinuria — Monitor for proteinuria. Hemorrhage — FRUZAQLA can cause "
            "serious and fatal hemorrhage. Arterial and Venous Thromboembolic Events — "
            "Permanently discontinue for serious events. Cardiac Dysfunction — Monitor for "
            "signs and symptoms. Hepatotoxicity — Monitor liver function tests. "
            "Wound Healing Complications — Withhold prior to surgery. "
            "Embryo-Fetal Toxicity — Can cause fetal harm.\n\n"
            "ADVERSE REACTIONS: Most common adverse reactions (≥10%) were hypertension, "
            "fatigue/asthenia, diarrhea, hand-foot skin reaction, dysphonia, proteinuria, "
            "hypothyroidism, mucositis, nausea, and abdominal pain."
        ),
    },
    {
        "placement": "footer",
        "text": (
            "Please see full Prescribing Information, including Patient Information.\n"
            "FRUZAQLA is a registered trademark of HUTCHMED Limited, licensed to Takeda.\n"
            "© 2024 Takeda Pharmaceuticals. All rights reserved. US-FRU-0001"
        ),
    },
]

# ── Hardcoded compliance rules ────────────────────────────────────────────────

PROHIBITED_WORDS = [
    "cure", "cures", "cured",
    "safe",
    "eliminate", "eliminates",
    "miracle",
    "guaranteed",
]

STRUCTURAL_RULES = [
    {
        "description": "ISI block must appear in every email",
        "severity": "error",
    },
    {
        "description": "All efficacy claims must cite the FRUZAQLA Phase 3 (FRESCO-2) trial",
        "severity": "warning",
    },
    {
        "description": "Fair balance must be presented with equal prominence to benefit claims",
        "severity": "warning",
    },
]

# ── Visual assets — icons from Style Guide pp.15-16 ──────────────────────────
# Actual image files must be exported manually from the PDF (Acrobat → Export Images)
# and placed in frontend/public/assets/icons/. Filenames match the slug below.

# Icons: page 16 JPEGs are the 15 shared icons (asset_2 through asset_17, asset_1 is the full page).
# PNGs from pages 14/23/24 are logos and compliance elements.
VISUAL_ASSETS = [
    # ── Shared icons — style guide p.16 (JPEGs, in order as they appear) ──
    {"name": "Clinical Studies",         "file": "jpeg/page_16_asset_2.jpeg",  "type": "icon", "description": "Shared icon for referencing clinical study data across HCP and patient materials."},
    {"name": "Safety and Efficacy",      "file": "jpeg/page_16_asset_7.jpeg",  "type": "icon", "description": "Shared icon for safety and efficacy messaging."},
    {"name": "More Time",                "file": "jpeg/page_16_asset_8.jpeg",  "type": "icon", "description": "Shared icon representing extended overall survival benefit."},
    {"name": "Once a Day",               "file": "jpeg/page_16_asset_9.jpeg",  "type": "icon", "description": "Convenient once-daily oral dosing icon."},
    {"name": "34% Reduction in Risk",    "file": "jpeg/page_16_asset_10.jpeg", "type": "icon", "description": "Key data icon: 34% reduction in risk of death vs placebo (FRESCO-2)."},
    {"name": "21 Days",                  "file": "jpeg/page_16_asset_11.jpeg", "type": "icon", "description": "21-day treatment cycle indicator."},
    {"name": "First in a Decade",        "file": "jpeg/page_16_asset_12.jpeg", "type": "icon", "description": "FRUZAQLA as first new mCRC approval in a decade."},
    {"name": "With or Without Food",     "file": "jpeg/page_16_asset_13.jpeg", "type": "icon", "description": "Dosing flexibility — can be taken with or without food."},
    {"name": "Discuss With Your Doctor", "file": "jpeg/page_16_asset_14.jpeg", "type": "icon", "description": "Shared CTA icon for patient materials."},
    {"name": "Clinical Data",            "file": "jpeg/page_16_asset_15.jpeg", "type": "icon", "description": "Shared icon for clinical data sections."},
    {"name": "Discover More",            "file": "jpeg/page_16_asset_16.jpeg", "type": "icon", "description": "Shared CTA icon for additional information."},
    # ── Clinical data slides (FRESCO-2 / Visual Aid) ──
    {"name": "MoA: VEGF Selectivity",      "file": "visual-aid/va-moa-vegf-selectivity.jpeg",  "type": "graph", "description": "FRUZAQLA mechanism of action — selective inhibitor of all 3 VEGF receptors vs first- and second-generation inhibitors."},
    {"name": "Patient Population Table",   "file": "visual-aid/va-patient-population.jpeg",    "type": "graph", "description": "FRESCO-2 baseline characteristics: FRUZAQLA + BSC (n=461) vs placebo + BSC (n=230)."},
    {"name": "OS Kaplan-Meier Curve",      "file": "visual-aid/va-os-km-curve.jpeg",           "type": "graph", "description": "Overall survival KM curve: FRUZAQLA 7.4 mo vs placebo 4.8 mo, HR 0.66 (95% CI 0.55–0.80), p<0.001. 34% reduction in risk of death."},
    {"name": "OS Subgroup Forest Plot",    "file": "visual-aid/va-os-subgroups.jpeg",           "type": "graph", "description": "OS benefit consistent across prespecified subgroups (RAS status, prior therapies, liver metastases, etc.)."},
    {"name": "PFS Kaplan-Meier Curve",     "file": "visual-aid/va-pfs-km-curve.jpeg",          "type": "graph", "description": "PFS KM curve: FRUZAQLA 3.7 mo vs placebo 1.8 mo, HR 0.32 (95% CI 0.27–0.39). 68% reduction in risk of disease progression or death."},
    {"name": "PFS Subgroup Forest Plot",   "file": "visual-aid/va-pfs-subgroups.jpeg",          "type": "graph", "description": "PFS benefit consistent across prespecified subgroups."},
    {"name": "Adverse Reactions Table",    "file": "visual-aid/va-adverse-reactions.jpeg",      "type": "graph", "description": "ARs occurring in ≥10% of patients: FRUZAQLA + BSC vs placebo + BSC (FRESCO-2)."},
    {"name": "Lab Abnormalities Table",    "file": "visual-aid/va-lab-abnormalities.jpeg",      "type": "graph", "description": "Grade 3/4 lab abnormalities. Manageable safety profile: low myelosuppression, low discontinuation rate."},
    {"name": "FRESCO Study Design",        "file": "visual-aid/va-fresco-study-design.jpeg",    "type": "graph", "description": "FRESCO Phase 3 study design (single-country China, N=416). Fruquintinib 5 mg QD 3 weeks on/1 week off vs placebo."},
    # ── Brand/logo elements ──
    {"name": "Hallmark Header",          "file": "hallmark-header.jpeg",        "type": "graphic", "description": "FRUZAQLA hallmark arc background — used as email header. Do not modify."},
    {"name": "Takeda Oncology Logo",     "file": "takeda-footer-logo.jpg",      "type": "graphic", "description": "Takeda Oncology footer logo with trademark attribution. Required on all emails."},
]

# ── Clinical PDFs to extract claims from ─────────────────────────────────────

CLINICAL_DOCS = [
    {
        "filename": "FRUZAQLA Prescribing Information - Solstice.pdf",
        "doc_type": "prescribing_info",
        "image_based": False,
    },
    {
        "filename": "FRUZAQLA Visual Aid - Solstice.pdf",
        "doc_type": "visual_aid",
        "image_based": True,
        "image_dir": os.path.join(REPO_ROOT, "fruzaqla_assets", "visual_aid"),
    },
]

# ── Email canvas template ─────────────────────────────────────────────────────

EMAIL_TEMPLATE = {
    "content_type": "email",
    "sections_json": [
        {
            "type": "header",
            "order": 0,
            "locked": True,
            "required": True,
            "boilerplate_category": None,
        },
        {
            "type": "free_text",
            "order": 10,
            "locked": False,
            "required": False,
            "boilerplate_category": None,
        },
        {
            "type": "isi",
            "order": 90,
            "locked": True,
            "required": True,
            "boilerplate_category": "boilerplate",
        },
        {
            "type": "takeda_logo",
            "order": 95,
            "locked": True,
            "required": True,
            "boilerplate_category": None,
        },
        {
            "type": "footer",
            "order": 100,
            "locked": True,
            "required": True,
            "boilerplate_category": "boilerplate",
        },
    ],
}


def seed():
    db = SessionLocal()
    try:
        # 1. ContentTemplate
        if not db.query(ContentTemplate).filter_by(content_type="email").first():
            db.add(ContentTemplate(**EMAIL_TEMPLATE))
            db.commit()
            print("ContentTemplate (email) seeded")

        # 2. Brand config
        if not db.query(BrandConfig).first():
            db.add(BrandConfig(tokens_json=BRAND_TOKENS))
            db.commit()
            print("BrandConfig seeded")

        # 3. Boilerplate claims (ISI + footer)
        if not db.query(ApprovedClaim).filter_by(category="boilerplate").first():
            for item in BOILERPLATE_CLAIMS:
                db.add(ApprovedClaim(
                    text=item["text"],
                    category="boilerplate",
                    source_document="FRUZAQLA Style Guide - Solstice.pdf",
                ))
            db.commit()
            print(f"Boilerplate claims seeded ({len(BOILERPLATE_CLAIMS)})")

        # 4. Visual assets (icons from style guide pp.15-16)
        if not db.query(VisualAsset).first():
            for asset in VISUAL_ASSETS:
                filename = asset["file"].split("/")[-1]
                db.add(VisualAsset(
                    filename=filename,
                    url=f"/assets/{asset['file']}",
                    asset_type=asset["type"],
                    description=asset["description"],
                    tags=[asset["name"]],
                ))
            db.commit()
            print(f"Visual assets seeded ({len(VISUAL_ASSETS)})")

        # 6. Compliance rules
        if not db.query(ComplianceRule).first():
            for word in PROHIBITED_WORDS:
                db.add(ComplianceRule(
                    rule_type="prohibited_word",
                    description=f'Prohibited word: "{word}"',
                    pattern=word,
                    severity="warning",
                ))
            for rule in STRUCTURAL_RULES:
                db.add(ComplianceRule(
                    rule_type="structural",
                    description=rule["description"],
                    severity=rule["severity"],
                ))
            db.commit()
            print(f"Compliance rules seeded ({len(PROHIBITED_WORDS) + len(STRUCTURAL_RULES)})")

        # 7. Extract claims from clinical PDFs via Claude
        for doc_info in CLINICAL_DOCS:
            path = os.path.join(REPO_ROOT, doc_info["filename"])

            if not os.path.exists(path):
                print(f"  NOT FOUND: {doc_info['filename']} — skipping")
                continue

            if db.query(SourceDocument).filter_by(filename=doc_info["filename"]).first():
                print(f"  Already ingested: {doc_info['filename']} — skipping")
                continue

            print(f"  Extracting claims: {doc_info['filename']} ...")

            doc = SourceDocument(
                filename=doc_info["filename"],
                doc_type=doc_info["doc_type"],
                upload_path=path,
                status="processing",
                uploaded_at=_now(),
            )
            db.add(doc)
            db.commit()
            db.refresh(doc)

            try:
                if doc_info.get("image_based"):
                    print(f"    (image-based PDF — using Claude Vision on {doc_info['image_dir']})")
                    result = extract_claims_from_images(doc_info["image_dir"], doc, db)
                else:
                    result = extract_claims(path, doc, db)
                doc.status = "complete"
                doc.processed_at = _now()
                doc.candidate_count = result["candidate_count"]
                db.commit()
                print(f"    {result['candidate_count']} candidate claims extracted")
            except Exception as exc:
                doc.status = "failed"
                db.commit()
                print(f"    FAILED: {exc}")

        # Summary
        pending = db.query(CandidateClaim).filter_by(status="pending_review").count()
        total = db.query(CandidateClaim).count()
        print(f"\nDone: {total} candidate claims ({pending} pending review)")
        print("Next: http://localhost:3000/admin/claims — approve claims to populate the canvas sidebar")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
