from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.certificate import Certificate
from app.models.user import User
from app.services.certificate_pdf import generate_certificate_pdf

router = APIRouter()


@router.get("/certificates/me")
async def my_certificates(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Certificate).where(Certificate.learner_id == user.id).order_by(Certificate.tier)
    )
    certs = result.scalars().all()
    tier_names = {1: "Participation", 2: "Completion", 3: "Merit", 4: "Excellence", 5: "Internship Candidate"}
    return [
        {
            "id": c.id,
            "tier": c.tier,
            "tier_name": tier_names.get(c.tier, ""),
            "status": c.status,
            "issued_at": c.issued_at,
        }
        for c in certs
    ]


@router.get("/certificates/{cert_id}/download")
async def download_certificate(
    cert_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Certificate).where(
            Certificate.id == cert_id, Certificate.learner_id == user.id
        )
    )
    cert = result.scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    if cert.status != "active":
        raise HTTPException(status_code=410, detail="Certificate has been revoked")

    pdf = generate_certificate_pdf(
        learner_name=f"{user.first_name} {user.last_name}",
        tier=cert.tier,
        issued_at=cert.issued_at,
        certificate_id=cert.id,
        verify_url=f"{settings.FRONTEND_URL}/verify/{cert.id}",
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="novalabs-certificate-{cert.tier}.pdf"'
        },
    )


@router.get("/certificates/{cert_id}/share")
async def share_certificate(cert_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Certificate).where(Certificate.id == cert_id))
    cert = result.scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return {"share_url": f"{settings.FRONTEND_URL}/verify/{cert_id}", "og_image_url": ""}


@router.get("/verify/{certificate_id}")
async def verify_certificate(certificate_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Certificate).where(Certificate.id == certificate_id))
    cert = result.scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    user_result = await db.execute(select(User).where(User.id == cert.learner_id))
    user = user_result.scalar_one_or_none()

    tier_names = {1: "Participation", 2: "Completion", 3: "Merit", 4: "Excellence", 5: "Internship Candidate"}
    return {
        "valid": cert.status == "active",
        "name": f"{user.first_name} {user.last_name}" if user else "",
        "tier": tier_names.get(cert.tier, ""),
        "issued_at": cert.issued_at,
        "status": cert.status,
    }
