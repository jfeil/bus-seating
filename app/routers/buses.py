from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db import Bus, SkiDay
from app.schemas.bus import BusCreate, BusRead, BusUpdate

router = APIRouter(prefix="/api/seasons/{season_id}/days/{day_id}/buses", tags=["buses"])


def _get_day_or_404(db: Session, season_id: str, day_id: str) -> SkiDay:
    day = db.get(SkiDay, day_id)
    if not day or day.season_id != season_id:
        raise HTTPException(404, "Day not found")
    return day


@router.post("", response_model=BusRead, status_code=201)
def create_bus(season_id: str, day_id: str, body: BusCreate, db: Session = Depends(get_db)):
    _get_day_or_404(db, season_id, day_id)
    bus = Bus(ski_day_id=day_id, name=body.name, capacity=body.capacity, reserved_seats=body.reserved_seats)
    db.add(bus)
    db.commit()
    db.refresh(bus)
    return bus


@router.get("", response_model=list[BusRead])
def list_buses(season_id: str, day_id: str, db: Session = Depends(get_db)):
    _get_day_or_404(db, season_id, day_id)
    return db.scalars(select(Bus).where(Bus.ski_day_id == day_id)).all()


@router.put("/{bus_id}", response_model=BusRead)
def update_bus(season_id: str, day_id: str, bus_id: str, body: BusUpdate, db: Session = Depends(get_db)):
    _get_day_or_404(db, season_id, day_id)
    bus = db.get(Bus, bus_id)
    if not bus or bus.ski_day_id != day_id:
        raise HTTPException(404, "Bus not found")
    if body.name is not None:
        bus.name = body.name
    if body.capacity is not None:
        bus.capacity = body.capacity
    if body.reserved_seats is not None:
        bus.reserved_seats = body.reserved_seats
    db.commit()
    db.refresh(bus)
    return bus


@router.delete("/{bus_id}", status_code=204)
def delete_bus(season_id: str, day_id: str, bus_id: str, db: Session = Depends(get_db)):
    _get_day_or_404(db, season_id, day_id)
    bus = db.get(Bus, bus_id)
    if not bus or bus.ski_day_id != day_id:
        raise HTTPException(404, "Bus not found")
    db.delete(bus)
    db.commit()
