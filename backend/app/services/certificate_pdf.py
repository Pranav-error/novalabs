"""Certificate PDF generation with reportlab (landscape A4)."""
import io
from datetime import datetime

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas

TIER_META = {
    1: ("Certificate of Participation", "#2F67C7"),
    2: ("Certificate of Completion", "#32D3E6"),
    3: ("Certificate of Merit", "#8A2BBE"),
    4: ("Certificate of Excellence", "#D21D8E"),
    5: ("Internship Candidate Certificate", "#F02B8F"),
}

NAVY = HexColor("#1B2A4A")
GRAY = HexColor("#6b7280")
LIGHT = HexColor("#9ca3af")


def generate_certificate_pdf(
    learner_name: str,
    tier: int,
    issued_at: datetime,
    certificate_id: str,
    verify_url: str,
) -> bytes:
    title, accent_hex = TIER_META.get(tier, (f"Certificate — Tier {tier}", "#2F67C7"))
    accent = HexColor(accent_hex)

    buf = io.BytesIO()
    width, height = landscape(A4)
    c = canvas.Canvas(buf, pagesize=landscape(A4))

    # Border
    c.setStrokeColor(accent)
    c.setLineWidth(3)
    c.rect(24, 24, width - 48, height - 48)
    c.setLineWidth(1)
    c.setStrokeColor(NAVY)
    c.rect(32, 32, width - 64, height - 64)

    # Header
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(width / 2, height - 100, "NOVA LABS")
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 13)
    c.drawCentredString(width / 2, height - 122, "30-Day Full-Stack Challenge")

    # Title
    c.setFillColor(accent)
    c.setFont("Helvetica-Bold", 30)
    c.drawCentredString(width / 2, height - 200, title)

    # Recipient
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2, height - 245, "This is proudly presented to")
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 34)
    c.drawCentredString(width / 2, height - 290, learner_name)

    # Rule under the name
    c.setStrokeColor(accent)
    c.setLineWidth(2)
    name_width = max(c.stringWidth(learner_name, "Helvetica-Bold", 34), 240)
    c.line((width - name_width) / 2, height - 302, (width + name_width) / 2, height - 302)

    # Body
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 13)
    c.drawCentredString(
        width / 2,
        height - 340,
        "for their dedication and achievement in the NOVA LABS 30-Day Full-Stack Developer Challenge.",
    )

    # Issued date
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(
        width / 2, height - 380, f"Issued on {issued_at.strftime('%B %d, %Y')}"
    )

    # Footer: certificate id + verification link
    c.setFillColor(LIGHT)
    c.setFont("Helvetica", 9)
    c.drawCentredString(width / 2, 60, f"Certificate ID: {certificate_id}")
    c.drawCentredString(width / 2, 46, f"Verify at: {verify_url}")

    c.showPage()
    c.save()
    return buf.getvalue()
