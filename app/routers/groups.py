from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.db import Group, Person, PersonPreference, Registration, RidePreference
from app.schemas.group import (
    GroupCreate,
    GroupRead,
    GroupUpdate,
    PersonUpdate,
    PersonRead,
    PersonPreferenceCreate,
    PersonPreferenceRead,
    RegistrationRead,
    RidePreferenceCreate,
    RidePreferenceRead,
)

router = APIRouter(prefix="/api/seasons/{season_id}", tags=["groups"])


# --- Groups ---

@router.post("/groups", response_model=GroupRead, status_code=201)
def create_group(season_id: str, body: GroupCreate, db: Session = Depends(get_db)):
    group = Group(season_id=season_id, name=body.name)
    for member in body.members:
        group.members.append(Person(name=member.name, is_instructor=member.is_instructor))
    db.add(group)
    db.flush()

    if body.register_for_days:
        for day_id in body.register_for_days:
            db.add(Registration(group_id=group.id, ski_day_id=day_id))

    db.commit()
    db.refresh(group)
    return group


@router.get("/groups", response_model=list[GroupRead])
def list_groups(season_id: str, db: Session = Depends(get_db)):
    return db.scalars(
        select(Group)
        .where(Group.season_id == season_id)
        .options(selectinload(Group.members))
    ).all()


@router.get("/groups/{group_id}", response_model=GroupRead)
def get_group(season_id: str, group_id: str, db: Session = Depends(get_db)):
    group = db.get(Group, group_id, options=[selectinload(Group.members)])
    if not group or group.season_id != season_id:
        raise HTTPException(404, "Group not found")
    return group


@router.put("/groups/{group_id}", response_model=GroupRead)
def update_group(season_id: str, group_id: str, body: GroupUpdate, db: Session = Depends(get_db)):
    group = db.get(Group, group_id, options=[selectinload(Group.members)])
    if not group or group.season_id != season_id:
        raise HTTPException(404, "Group not found")
    if body.name is not None:
        group.name = body.name
    db.commit()
    db.refresh(group)
    return group


@router.delete("/groups/{group_id}", status_code=204)
def delete_group(season_id: str, group_id: str, db: Session = Depends(get_db)):
    group = db.get(Group, group_id)
    if not group or group.season_id != season_id:
        raise HTTPException(404, "Group not found")
    db.delete(group)
    db.commit()


# --- Persons within groups ---

@router.put("/groups/{group_id}/members/{person_id}", response_model=PersonRead)
def update_person(
    season_id: str, group_id: str, person_id: str, body: PersonUpdate, db: Session = Depends(get_db)
):
    person = db.get(Person, person_id)
    if not person or person.group_id != group_id:
        raise HTTPException(404, "Person not found")
    group = db.get(Group, group_id)
    if not group or group.season_id != season_id:
        raise HTTPException(404, "Group not found")
    if body.name is not None:
        person.name = body.name
    if body.is_instructor is not None:
        person.is_instructor = body.is_instructor
    db.commit()
    db.refresh(person)
    return person


# --- Registrations ---

@router.post("/registrations", response_model=RegistrationRead, status_code=201)
def register_group(season_id: str, group_id: str, day_id: str, db: Session = Depends(get_db)):
    group = db.get(Group, group_id)
    if not group or group.season_id != season_id:
        raise HTTPException(404, "Group not found")
    reg = Registration(group_id=group_id, ski_day_id=day_id)
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg


@router.post("/registrations/bulk", response_model=list[RegistrationRead], status_code=201)
def register_group_bulk(
    season_id: str, group_id: str, day_ids: list[str], db: Session = Depends(get_db)
):
    group = db.get(Group, group_id)
    if not group or group.season_id != season_id:
        raise HTTPException(404, "Group not found")
    registrations = []
    for day_id in day_ids:
        reg = Registration(group_id=group_id, ski_day_id=day_id)
        db.add(reg)
        registrations.append(reg)
    db.commit()
    for reg in registrations:
        db.refresh(reg)
    return registrations


@router.get("/registrations", response_model=list[RegistrationRead])
def list_registrations(season_id: str, db: Session = Depends(get_db)):
    return db.scalars(
        select(Registration).join(Group).where(Group.season_id == season_id)
    ).all()


@router.delete("/registrations/{registration_id}", status_code=204)
def delete_registration(season_id: str, registration_id: str, db: Session = Depends(get_db)):
    reg = db.get(Registration, registration_id)
    if not reg:
        raise HTTPException(404, "Registration not found")
    db.delete(reg)
    db.commit()


# --- Ride Preferences ---

@router.post("/ride-preferences", response_model=RidePreferenceRead, status_code=201)
def create_ride_preference(
    season_id: str, body: RidePreferenceCreate, db: Session = Depends(get_db)
):
    pref = RidePreference(
        season_id=season_id,
        group_a_id=body.group_a_id,
        group_b_id=body.group_b_id,
    )
    db.add(pref)
    db.commit()
    db.refresh(pref)
    return pref


@router.get("/ride-preferences", response_model=list[RidePreferenceRead])
def list_ride_preferences(season_id: str, db: Session = Depends(get_db)):
    return db.scalars(
        select(RidePreference).where(RidePreference.season_id == season_id)
    ).all()


@router.delete("/ride-preferences/{preference_id}", status_code=204)
def delete_ride_preference(season_id: str, preference_id: str, db: Session = Depends(get_db)):
    pref = db.get(RidePreference, preference_id)
    if not pref or pref.season_id != season_id:
        raise HTTPException(404, "Preference not found")
    db.delete(pref)
    db.commit()


# --- Person Preferences ---

@router.post("/person-preferences", response_model=PersonPreferenceRead, status_code=201)
def create_person_preference(
    season_id: str, body: PersonPreferenceCreate, db: Session = Depends(get_db)
):
    person_a = db.get(Person, body.person_a_id)
    person_b = db.get(Person, body.person_b_id)
    if not person_a or not person_b:
        raise HTTPException(404, "Person not found")

    pref = PersonPreference(
        season_id=season_id,
        person_a_id=body.person_a_id,
        person_b_id=body.person_b_id,
    )
    db.add(pref)
    db.commit()
    db.refresh(pref)
    return PersonPreferenceRead(
        id=pref.id,
        season_id=pref.season_id,
        person_a_id=pref.person_a_id,
        person_b_id=pref.person_b_id,
        person_a_name=person_a.name,
        person_b_name=person_b.name,
        group_a_name=person_a.group.name,
        group_b_name=person_b.group.name,
    )


@router.get("/person-preferences", response_model=list[PersonPreferenceRead])
def list_person_preferences(season_id: str, db: Session = Depends(get_db)):
    prefs = db.scalars(
        select(PersonPreference)
        .where(PersonPreference.season_id == season_id)
        .options(
            selectinload(PersonPreference.person_a).selectinload(Person.group),
            selectinload(PersonPreference.person_b).selectinload(Person.group),
        )
    ).all()
    return [
        PersonPreferenceRead(
            id=p.id,
            season_id=p.season_id,
            person_a_id=p.person_a_id,
            person_b_id=p.person_b_id,
            person_a_name=p.person_a.name,
            person_b_name=p.person_b.name,
            group_a_name=p.person_a.group.name,
            group_b_name=p.person_b.group.name,
        )
        for p in prefs
    ]


@router.delete("/person-preferences/{preference_id}", status_code=204)
def delete_person_preference(season_id: str, preference_id: str, db: Session = Depends(get_db)):
    pref = db.get(PersonPreference, preference_id)
    if not pref or pref.season_id != season_id:
        raise HTTPException(404, "Preference not found")
    db.delete(pref)
    db.commit()
