from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db import Season
from app.schemas.season import SeasonCreate, SeasonRead

router = APIRouter(prefix="/api/seasons", tags=["seasons"])


@router.post("", response_model=SeasonRead, status_code=201)
def create_season(body: SeasonCreate, db: Session = Depends(get_db)):
    season = Season(name=body.name)
    db.add(season)
    db.commit()
    db.refresh(season)
    return season


@router.get("", response_model=list[SeasonRead])
def list_seasons(db: Session = Depends(get_db)):
    return db.scalars(select(Season)).all()


@router.get("/{season_id}", response_model=SeasonRead)
def get_season(season_id: str, db: Session = Depends(get_db)):
    season = db.get(Season, season_id)
    if not season:
        raise HTTPException(404, "Season not found")
    return season


@router.delete("/{season_id}", status_code=204)
def delete_season(season_id: str, db: Session = Depends(get_db)):
    season = db.get(Season, season_id)
    if not season:
        raise HTTPException(404, "Season not found")
    db.delete(season)
    db.commit()
