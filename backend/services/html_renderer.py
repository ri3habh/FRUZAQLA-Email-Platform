"""
Renders a canvas state into a self-contained HTML email.
- Inline CSS only (email client compatibility)
- Arial font (style guide email exception)
- Brand colors from BrandConfig
- Images base64-encoded so the file is fully self-contained
- Compliance metadata embedded as HTML comments
"""
import base64
import os



def render_email(
    blocks: list[dict],
    brand_tokens: dict,
    project_title: str,
    compliance_status: str,
) -> str:
    primary   = brand_tokens.get("primary_color", "#002855")
    secondary = brand_tokens.get("secondary_color", "#8C4799")
    light_blue = brand_tokens.get("light_blue", "#59CBE8")
    max_width = brand_tokens.get("email_max_width", "600px")
    # Arial per style guide email exception
    font      = "Arial, Helvetica, sans-serif"

    sorted_blocks = sorted(blocks, key=lambda b: b.get("order", 0))

    blocks_html = "\n".join(
        _render_block(b, primary, secondary, font)
        for b in sorted_blocks
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{_escape(project_title)}</title>
  <!--
    SOLSTICE COMPLIANCE METADATA
    Project: {_escape(project_title)}
    Compliance status: {compliance_status}
    Generated: {_utcnow()}
    Verified blocks: {sum(1 for b in blocks if b.get("compliance_status") == "verified")}
    Total blocks: {len(blocks)}
  -->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:{font};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:20px 0;">
        <table role="presentation" width="{max_width}" cellpadding="0" cellspacing="0"
               style="max-width:{max_width};width:100%;background-color:#ffffff;
                      border-radius:4px;overflow:hidden;">
          {blocks_html}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _render_block(block: dict, primary: str, secondary: str, font: str) -> str:
    btype   = block.get("type", "free_text")
    locked  = block.get("locked", False)
    content = block.get("content", {})
    text    = content.get("text", "")
    source  = block.get("source")
    claim_id = content.get("claim_id")

    # Compliance annotation comment
    annotation = ""
    if claim_id:
        doc  = source.get("document", "") if source else ""
        page = source.get("page", "") if source else ""
        annotation = f"\n          <!-- claim_id:{claim_id} source:{_escape(doc)} page:{page} -->"

    if btype == "header":
        hallmark_path = os.path.normpath(os.path.join(
            os.path.dirname(__file__), "..", "..",
            "frontend", "public", "assets", "hallmark-header.jpeg"
        ))
        hallmark_b64 = ""
        if os.path.exists(hallmark_path):
            with open(hallmark_path, "rb") as f:
                hallmark_b64 = "data:image/jpeg;base64," + base64.standard_b64encode(f.read()).decode()

        if hallmark_b64:
            return f"""
          <!-- BLOCK:header locked:true -->
          <tr>
            <td style="padding:0;position:relative;background-color:{primary};">
              <img src="{hallmark_b64}" alt="FRUZAQLA"
                   width="600" style="display:block;width:100%;max-width:600px;" />
              <div style="padding:12px 32px 16px;background-color:{primary};">
                <span style="font-family:{font};font-size:20px;font-weight:bold;
                             color:#ffffff;letter-spacing:0.5px;">
                  FRUZAQLA<sup style="font-size:11px;">®</sup>
                </span>
                <span style="font-family:{font};font-size:11px;color:rgba(255,255,255,0.8);
                             margin-left:6px;">(fruquintinib)</span>
              </div>
            </td>
          </tr>"""
        # fallback if image missing
        return f"""
          <!-- BLOCK:header locked:true -->
          <tr>
            <td style="background-color:{primary};padding:24px 32px;">
              <span style="font-family:{font};font-size:20px;font-weight:bold;color:#ffffff;">
                FRUZAQLA<sup style="font-size:11px;">®</sup>
              </span>
            </td>
          </tr>"""

    if btype == "isi":
        paras = text.replace("\n\n", "</p><p>").replace("\n", "<br/>") if text else ""
        return f"""
          <!-- BLOCK:isi locked:true -->
          <tr>
            <td style="background-color:#f9f9f9;border-top:2px solid {primary};
                       padding:16px 32px;">
              <p style="font-family:{font};font-size:9px;color:#555555;
                        line-height:1.5;margin:0;">
                {paras}
              </p>
            </td>
          </tr>"""

    if btype == "takeda_logo":
        logo_path = os.path.normpath(os.path.join(
            os.path.dirname(__file__), "..", "..",
            "frontend", "public", "assets", "takeda-footer-logo.jpg"
        ))
        logo_html = ""
        if os.path.exists(logo_path):
            with open(logo_path, "rb") as f:
                logo_b64 = "data:image/jpeg;base64," + base64.standard_b64encode(f.read()).decode()
            logo_html = f'<img src="{logo_b64}" alt="Takeda Oncology" style="display:block;max-width:360px;width:100%;margin:0 auto 10px auto;" />'
        trademark = (
            "TAKEDA\u00ae and the TAKEDA logo\u00ae are registered trademarks of Takeda Pharmaceutical Company Limited. "
            "FRUZAQLA and \u00d4 are trademarks of HUTCHMED Group Enterprises Limited, used under license. "
            "\u00a9 20XX Takeda Pharmaceuticals U.S.A., Inc. All rights reserved. USO-FRQ-XXXX XX/20XX"
        )
        return f"""
          <!-- BLOCK:takeda_logo locked:true -->
          <tr>
            <td style="background-color:#ffffff;padding:16px 32px;text-align:center;border-top:1px solid #eeeeee;">
              {logo_html}
              <p style="font-family:{font};font-size:8px;color:#777777;line-height:1.5;margin:0;">
                {_escape(trademark)}
              </p>
            </td>
          </tr>"""

    if btype == "footer":
        paras = text.replace("\n", "<br/>") if text else ""
        return f"""
          <!-- BLOCK:footer locked:true -->
          <tr>
            <td style="background-color:{primary};padding:16px 32px;text-align:center;">
              <p style="font-family:{font};font-size:9px;color:rgba(255,255,255,0.75);
                        line-height:1.6;margin:0;">
                {paras}
              </p>
            </td>
          </tr>"""


    if btype == "drawing":
        drawing_data = content.get("drawing_data", "")
        if not drawing_data:
            return ""
        return f"""
          <!-- BLOCK:drawing -->
          <tr>
            <td style="padding:16px 32px;">
              <img src="{drawing_data}" alt="Drawing"
                   style="max-width:100%;display:block;border:1px solid #eeeeee;border-radius:4px;" />
            </td>
          </tr>"""

    if btype == "divider":
        return f"""
          <!-- BLOCK:divider -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:1px solid #eeeeee;margin:8px 0;" />
            </td>
          </tr>"""

    # free_text (default) — may have an attached image
    asset_url = content.get("asset_url", "")
    asset_html = ""
    if asset_url:
        b64 = _inline_image(asset_url)
        if b64:
            asset_name = _escape(content.get("asset_name", ""))
            asset_html = f"""
                <div style="margin-bottom:10px;">
                  <img src="{b64}" alt="{asset_name}"
                       style="max-width:180px;max-height:120px;object-fit:contain;display:block;" />
                </div>"""

    if not text and not asset_html:
        return ""

    # First sentence bold as a headline, rest as body
    sentences = text.split(". ", 1)
    if len(sentences) == 2:
        headline = _escape(sentences[0]) + "."
        body     = _escape(sentences[1])
        inner = f"""
                <p style="font-family:{font};font-size:16px;font-weight:bold;
                           color:{primary};margin:0 0 8px 0;line-height:1.4;">
                  {headline}
                </p>
                <p style="font-family:{font};font-size:14px;color:#333333;
                           margin:0;line-height:1.6;">
                  {body}
                </p>"""
    else:
        inner = f"""
                <p style="font-family:{font};font-size:14px;color:#333333;
                           margin:0;line-height:1.6;">
                  {_escape(text)}
                </p>"""

    source_line = ""
    if source:
        doc  = _escape(source.get("document", ""))
        page = source.get("page", "")
        page_str = f", p.{page}" if page else ""
        source_line = f"""
                <p style="font-family:{font};font-size:9px;color:#999999;
                           margin:8px 0 0 0;">
                  Source: {doc}{page_str}
                </p>"""

    border_left = f"border-left:3px solid {secondary};padding-left:12px;" if locked else ""

    return f"""
          <!-- BLOCK:free_text verified:{block.get("compliance_status") == "verified"} -->{annotation}
          <tr>
            <td style="padding:16px 32px;">
              <div style="{border_left}">
                {asset_html}
                {inner}
                {source_line}
              </div>
            </td>
          </tr>"""


def _inline_image(url: str) -> str:
    """Convert a relative /assets/... URL to a base64 data URI."""
    # url looks like /assets/jpeg/page_16_asset_2.jpeg
    rel_path = url.lstrip("/")
    # Walk up from this file to find frontend/public
    base = os.path.join(
        os.path.dirname(__file__),   # backend/services/
        "..", "..",                   # repo root
        "frontend", "public",
        rel_path,
    )
    abs_path = os.path.normpath(base)
    if not os.path.exists(abs_path):
        return ""
    ext = os.path.splitext(abs_path)[1].lower().lstrip(".")
    mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "gif": "gif", "svg": "svg+xml"}.get(ext, "jpeg")
    with open(abs_path, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode()
    return f"data:image/{mime};base64,{data}"


def _escape(text: str) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _utcnow() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
