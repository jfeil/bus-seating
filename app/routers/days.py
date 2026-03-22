from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db import Bus, BusTemplate, SkiDay
from app.schemas.day import SkiDayCreate, SkiDayRead, SkiDayUpdate

router = APIRouter(prefix="/api/seasons/{season_id}/days", tags=["days"])


@router.post("", response_model=SkiDayRead, status_code=201)
def create_day(season_id: str, body: SkiDayCreate, db: Session = Depends(get_db)):
    day = SkiDay(season_id=season_id, name=body.name, date=body.date)
    db.add(day)
    db.flush()

    # Auto-create buses from season templates
    templates = db.scalars(
        select(BusTemplate).where(BusTemplate.season_id == season_id)
    ).all()
    for tpl in templates:
        db.add(Bus(
            ski_day_id=day.id, name=tpl.name,
            capacity=tpl.capacity, reserved_seats=tpl.reserved_seats,
        ))

    db.commit()
    db.refresh(day)
    return day


@router.get("", response_model=list[SkiDayRead])
def list_days(season_id: str, db: Session = Depends(get_db)):
    return db.scalars(
        select(SkiDay).where(SkiDay.season_id == season_id)
    ).all()


@router.get("/{day_id}", response_model=SkiDayRead)
def get_day(season_id: str, day_id: str, db: Session = Depends(get_db)):
    day = db.get(SkiDay, day_id)
    if not day or day.season_id != season_id:
        raise HTTPException(404, "Day not found")
    return day


@router.put("/{day_id}", response_model=SkiDayRead)
def update_day(season_id: str, day_id: str, body: SkiDayUpdate, db: Session = Depends(get_db)):
    day = db.get(SkiDay, day_id)
    if not day or day.season_id != season_id:
        raise HTTPException(404, "Day not found")
    if body.name is not None:
        day.name = body.name
    if body.date is not None:
        day.date = body.date
    db.commit()
    db.refresh(day)
    return day


@router.delete("/{day_id}", status_code=204)
def delete_day(season_id: str, day_id: str, db: Session = Depends(get_db)):
    day = db.get(SkiDay, day_id)
    if not day or day.season_id != season_id:
        raise HTTPException(404, "Day not found")
    db.delete(day)
    db.commit()
