from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db import BusTemplate, Season
from app.schemas.bus import BusTemplateCreate, BusTemplateRead, BusTemplateUpdate

router = APIRouter(prefix="/api/seasons/{season_id}/bus-templates", tags=["bus-templates"])


def _get_season_or_404(db: Session, season_id: str) -> Season:
    season = db.get(Season, season_id)
    if not season:
        raise HTTPException(404, "Season not found")
    return season


@router.post("", response_model=BusTemplateRead, status_code=201)
def create_bus_template(season_id: str, body: BusTemplateCreate, db: Session = Depends(get_db)):
    _get_season_or_404(db, season_id)
    tpl = BusTemplate(
        season_id=season_id, name=body.name,
        capacity=body.capacity, reserved_seats=body.reserved_seats,
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.get("", response_model=list[BusTemplateRead])
def list_bus_templates(season_id: str, db: Session = Depends(get_db)):
    _get_season_or_404(db, season_id)
    return db.scalars(select(BusTemplate).where(BusTemplate.season_id == season_id)).all()


@router.put("/{template_id}", response_model=BusTemplateRead)
def update_bus_template(season_id: str, template_id: str, body: BusTemplateUpdate, db: Session = Depends(get_db)):
    _get_season_or_404(db, season_id)
    tpl = db.get(BusTemplate, template_id)
    if not tpl or tpl.season_id != season_id:
        raise HTTPException(404, "Bus template not found")
    if body.name is not None:
        tpl.name = body.name
    if body.capacity is not None:
        tpl.capacity = body.capacity
    if body.reserved_seats is not None:
        tpl.reserved_seats = body.reserved_seats
    db.commit()
    db.refresh(tpl)
    return tpl


@router.delete("/{template_id}", status_code=204)
def delete_bus_template(season_id: str, template_id: str, db: Session = Depends(get_db)):
    _get_season_or_404(db, season_id)
    tpl = db.get(BusTemplate, template_id)
    if not tpl or tpl.season_id != season_id:
        raise HTTPException(404, "Bus template not found")
    db.delete(tpl)
    db.commit()
