import csv
import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.db import Group, Person, PersonAbsence, PersonPreference, Registration, RidePreference, SkiDay
from app.schemas.group import (
    GroupCreate,
    GroupRead,
    GroupUpdate,
    PersonAbsenceCreate,
    PersonAbsenceRead,
    PersonUpdate,
    PersonRead,
    PersonPreferenceCreate,
    PersonPreferenceRead,
    PersonPreferenceUpdate,
    PERSON_TYPES,
    RegistrationRead,
    RidePreferenceCreate,
    RidePreferenceRead,
    RidePreferenceUpdate,
)

router = APIRouter(prefix="/api/seasons/{season_id}", tags=["groups"])


# --- Groups ---

@router.post("/groups", response_model=GroupRead, status_code=201)
def create_group(season_id: str, body: GroupCreate, db: Session = Depends(get_db)):
    group = Group(season_id=season_id, name=body.name)
    for member in body.members:
        group.members.append(Person(
            first_name=member.first_name,
            last_name=member.last_name,
            person_type=member.person_type,
            birth_year=member.birth_year,
        ))
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


@router.delete("/groups", status_code=204)
def delete_all_groups(season_id: str, db: Session = Depends(get_db)):
    # Delete preferences first (no cascade from groups)
    for pref in db.scalars(select(RidePreference).where(RidePreference.season_id == season_id)).all():
        db.delete(pref)
    for pref in db.scalars(select(PersonPreference).where(PersonPreference.season_id == season_id)).all():
        db.delete(pref)
    for group in db.scalars(select(Group).where(Group.season_id == season_id)).all():
        db.delete(group)
    db.commit()


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
    if body.first_name is not None:
        person.first_name = body.first_name
    if body.last_name is not None:
        person.last_name = body.last_name
    if body.person_type is not None:
        person.person_type = body.person_type
    if body.birth_year is not None:
        person.birth_year = body.birth_year
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


@router.patch("/ride-preferences/{preference_id}", response_model=RidePreferenceRead)
def update_ride_preference(
    season_id: str, preference_id: str, body: RidePreferenceUpdate, db: Session = Depends(get_db)
):
    pref = db.get(RidePreference, preference_id)
    if not pref or pref.season_id != season_id:
        raise HTTPException(404, "Preference not found")
    pref.weight = body.weight
    db.commit()
    db.refresh(pref)
    return pref


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
        person_a_name=person_a.full_name,
        person_b_name=person_b.full_name,
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
            person_a_name=p.person_a.full_name,
            person_b_name=p.person_b.full_name,
            group_a_name=p.person_a.group.name,
            group_b_name=p.person_b.group.name,
        )
        for p in prefs
    ]


@router.patch("/person-preferences/{preference_id}", response_model=PersonPreferenceRead)
def update_person_preference(
    season_id: str, preference_id: str, body: PersonPreferenceUpdate, db: Session = Depends(get_db)
):
    pref = db.get(PersonPreference, preference_id)
    if not pref or pref.season_id != season_id:
        raise HTTPException(404, "Preference not found")
    pref.weight = body.weight
    db.commit()
    db.refresh(pref)
    person_a = db.get(Person, pref.person_a_id)
    person_b = db.get(Person, pref.person_b_id)
    return PersonPreferenceRead(
        id=pref.id,
        season_id=pref.season_id,
        person_a_id=pref.person_a_id,
        person_b_id=pref.person_b_id,
        person_a_name=person_a.full_name,
        person_b_name=person_b.full_name,
        group_a_name=person_a.group.name,
        group_b_name=person_b.group.name,
        weight=pref.weight,
    )


@router.delete("/person-preferences/{preference_id}", status_code=204)
def delete_person_preference(season_id: str, preference_id: str, db: Session = Depends(get_db)):
    pref = db.get(PersonPreference, preference_id)
    if not pref or pref.season_id != season_id:
        raise HTTPException(404, "Preference not found")
    db.delete(pref)
    db.commit()


# --- Person Absences ---

@router.post("/person-absences", response_model=PersonAbsenceRead, status_code=201)
def create_person_absence(
    season_id: str, body: PersonAbsenceCreate, db: Session = Depends(get_db)
):
    person = db.get(Person, body.person_id)
    if not person:
        raise HTTPException(404, "Person not found")
    group = db.get(Group, person.group_id)
    if not group or group.season_id != season_id:
        raise HTTPException(404, "Person not found in this season")
    day = db.get(SkiDay, body.ski_day_id)
    if not day or day.season_id != season_id:
        raise HTTPException(404, "Day not found in this season")

    existing = db.scalar(
        select(PersonAbsence)
        .where(PersonAbsence.person_id == body.person_id, PersonAbsence.ski_day_id == body.ski_day_id)
    )
    if existing:
        raise HTTPException(409, "Absence already exists")

    absence = PersonAbsence(person_id=body.person_id, ski_day_id=body.ski_day_id)
    db.add(absence)
    db.commit()
    db.refresh(absence)
    return PersonAbsenceRead(
        id=absence.id,
        person_id=absence.person_id,
        ski_day_id=absence.ski_day_id,
        person_name=person.full_name,
        day_name=day.name,
    )


@router.get("/person-absences", response_model=list[PersonAbsenceRead])
def list_person_absences(season_id: str, db: Session = Depends(get_db)):
    absences = db.scalars(
        select(PersonAbsence)
        .join(Person)
        .join(Group)
        .where(Group.season_id == season_id)
        .options(
            selectinload(PersonAbsence.person),
            selectinload(PersonAbsence.ski_day),
        )
    ).all()
    return [
        PersonAbsenceRead(
            id=a.id,
            person_id=a.person_id,
            ski_day_id=a.ski_day_id,
            person_name=a.person.full_name,
            day_name=a.ski_day.name,
        )
        for a in absences
    ]


@router.delete("/person-absences/{absence_id}", status_code=204)
def delete_person_absence(season_id: str, absence_id: str, db: Session = Depends(get_db)):
    absence = db.get(PersonAbsence, absence_id)
    if not absence:
        raise HTTPException(404, "Absence not found")
    db.delete(absence)
    db.commit()


# --- CSV Import ---

_ATTENDING_MARKERS = frozenset({"x", "s", "k"})


class CsvImportRequest(BaseModel):
    csv_text: str


class CsvImportResult(BaseModel):
    days_created: int
    groups_created: int
    persons_created: int
    absences_created: int
    person_preferences_created: int = 0
    ride_preferences_created: int = 0


@router.post("/import-csv", response_model=CsvImportResult)
def import_csv(season_id: str, body: CsvImportRequest, db: Session = Depends(get_db)):
    season = db.scalar(select(SkiDay.season_id).where(SkiDay.season_id == season_id).limit(1))
    # Just verify season exists via any table; simpler: try to proceed
    reader = csv.reader(io.StringIO(body.csv_text.strip()))
    header = next(reader, None)
    if not header:
        raise HTTPException(400, "Empty CSV")

    # Normalize header
    header = [h.strip() for h in header]

    # Find column indices
    header_lower = [h.lower() for h in header]

    # Name columns: either "first_name"+"last_name" or single "name"
    first_name_col = next((i for i, h in enumerate(header_lower) if h == "first_name"), None)
    last_name_col = next((i for i, h in enumerate(header_lower) if h == "last_name"), None)
    name_col = next((i for i, h in enumerate(header_lower) if h == "name"), None)

    if first_name_col is None and name_col is None:
        raise HTTPException(400, "Missing 'Name' or 'first_name'/'last_name' columns")

    try:
        type_col = next(i for i, h in enumerate(header_lower) if h == "type")
    except StopIteration:
        raise HTTPException(400, "Missing 'Type' column")
    try:
        group_col = next(i for i, h in enumerate(header_lower) if h == "busgruppe")
    except StopIteration:
        raise HTTPException(400, "Missing 'Busgruppe' column")

    # Optional Fahrtwunsch column
    pref_col = next((i for i, h in enumerate(header_lower) if h == "fahrtwunsch"), None)

    # Tag columns are everything not a known column
    known_cols = {type_col, group_col}
    if first_name_col is not None:
        known_cols.add(first_name_col)
    if last_name_col is not None:
        known_cols.add(last_name_col)
    if name_col is not None:
        known_cols.add(name_col)
    if pref_col is not None:
        known_cols.add(pref_col)
    tag_cols = [i for i in range(len(header)) if i not in known_cols]
    day_names = [header[i] for i in tag_cols]

    # Reuse existing days or create new ones
    existing_days = {
        d.name: d
        for d in db.scalars(select(SkiDay).where(SkiDay.season_id == season_id)).all()
    }
    days: list[SkiDay] = []
    days_created_count = 0
    for day_name in day_names:
        if day_name in existing_days:
            days.append(existing_days[day_name])
        else:
            day = SkiDay(season_id=season_id, name=day_name)
            db.add(day)
            days.append(day)
            days_created_count += 1
    db.flush()

    # Parse rows
    type_map = {t: t for t in PERSON_TYPES}
    type_map.update({t.capitalize(): t for t in PERSON_TYPES})

    rows: list[dict] = []
    for row in reader:
        if len(row) < len(header):
            row.extend([""] * (len(header) - len(row)))

        # Parse name
        if first_name_col is not None:
            first_name = row[first_name_col].strip()
            last_name = row[last_name_col].strip() if last_name_col is not None else ""
        else:
            full = row[name_col].strip()
            if not full:
                continue
            parts = full.rsplit(" ", 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ""

        if not first_name and not last_name:
            continue

        raw_type = row[type_col].strip()
        person_type = type_map.get(raw_type, "freifahrer")
        group_key = row[group_col].strip()
        day_attendance = {
            days[idx].id: row[tag_cols[idx]].strip().lower() in _ATTENDING_MARKERS
            for idx in range(len(tag_cols))
        }
        pref_raw = row[pref_col].strip() if pref_col is not None else ""
        rows.append({
            "first_name": first_name,
            "last_name": last_name,
            "person_type": person_type,
            "group_key": group_key,
            "day_attendance": day_attendance,
            "fahrtwunsch": pref_raw,
        })

    # Group rows by group_key; empty key = solo group
    groups_by_key: dict[str, list[dict]] = {}
    solo_counter = 0
    for row in rows:
        key = row["group_key"]
        if not key:
            solo_counter += 1
            key = f"__solo_{solo_counter}"
            row["group_key"] = key
        groups_by_key.setdefault(key, []).append(row)

    # Create groups, registrations, and absences
    groups_created = 0
    persons_created = 0
    absences_created = 0

    # Track mappings for preference resolution
    group_by_key: dict[str, Group] = {}
    person_by_full_name: dict[str, Person] = {}
    person_to_row: list[tuple[Person, dict]] = []  # (person, row_dict)

    for group_key, members in groups_by_key.items():
        group_name = f"{members[0]['first_name']} {members[0]['last_name']}".strip() if group_key.startswith("__solo_") else group_key
        group = Group(season_id=season_id, name=group_name)

        persons: list[tuple[Person, dict[str, bool]]] = []
        for m in members:
            person = Person(first_name=m["first_name"], last_name=m["last_name"], person_type=m["person_type"])
            group.members.append(person)
            persons.append((person, m["day_attendance"]))
            full_name = f"{m['first_name']} {m['last_name']}".strip().lower()
            person_by_full_name[full_name] = person
            if m["fahrtwunsch"]:
                person_to_row.append((person, m))

        db.add(group)
        db.flush()
        group_by_key[group_key] = group
        persons_created += len(persons)

        # Register group for days where at least one member attends
        for day in days:
            anyone_attends = any(att[day.id] for _, att in persons)
            if anyone_attends:
                db.add(Registration(group_id=group.id, ski_day_id=day.id))

                # Create absences for members who don't attend this day
                for person, attendance in persons:
                    if not attendance[day.id]:
                        db.add(PersonAbsence(person_id=person.id, ski_day_id=day.id))
                        absences_created += 1

        groups_created += 1

    # Resolve Fahrtwunsch preferences
    person_pref_pairs: set[tuple[str, str]] = set()  # normalized (min_id, max_id)
    ride_pref_pairs: set[tuple[str, str]] = set()

    for person, row_data in person_to_row:
        entries = [e.strip() for e in row_data["fahrtwunsch"].split(";") if e.strip()]
        for entry in entries:
            if entry.startswith("#"):
                # Group reference → RidePreference
                ref_key = entry[1:]
                target_group = group_by_key.get(ref_key)
                if target_group and target_group.id != person.group_id:
                    pair = (min(person.group_id, target_group.id), max(person.group_id, target_group.id))
                    ride_pref_pairs.add(pair)
            else:
                # Person name reference → PersonPreference
                target = person_by_full_name.get(entry.lower())
                if target and target.id != person.id:
                    pair = (min(person.id, target.id), max(person.id, target.id))
                    person_pref_pairs.add(pair)

    person_prefs_created = 0
    for a_id, b_id in person_pref_pairs:
        db.add(PersonPreference(season_id=season_id, person_a_id=a_id, person_b_id=b_id))
        person_prefs_created += 1

    ride_prefs_created = 0
    for a_id, b_id in ride_pref_pairs:
        db.add(RidePreference(season_id=season_id, group_a_id=a_id, group_b_id=b_id))
        ride_prefs_created += 1

    db.commit()

    return CsvImportResult(
        days_created=days_created_count,
        groups_created=groups_created,
        persons_created=persons_created,
        absences_created=absences_created,
        person_preferences_created=person_prefs_created,
        ride_preferences_created=ride_prefs_created,
    )


@router.get("/export-csv")
def export_csv(season_id: str, db: Session = Depends(get_db)):
    # Load all data
    days = db.scalars(select(SkiDay).where(SkiDay.season_id == season_id)).all()
    groups = db.scalars(
        select(Group)
        .where(Group.season_id == season_id)
        .options(selectinload(Group.members), selectinload(Group.registrations))
    ).all()
    absences = db.scalars(
        select(PersonAbsence)
        .join(Person)
        .join(Group)
        .where(Group.season_id == season_id)
    ).all()
    ride_prefs = db.scalars(
        select(RidePreference).where(RidePreference.season_id == season_id)
    ).all()
    person_prefs = db.scalars(
        select(PersonPreference)
        .where(PersonPreference.season_id == season_id)
        .options(
            selectinload(PersonPreference.person_a),
            selectinload(PersonPreference.person_b),
        )
    ).all()

    # Build lookup maps
    absent_set = {(a.person_id, a.ski_day_id) for a in absences}
    group_by_id = {g.id: g for g in groups}
    person_by_id: dict[str, Person] = {}
    for g in groups:
        for m in g.members:
            person_by_id[m.id] = m

    # Group registered day IDs
    group_day_ids: dict[str, set[str]] = {}
    for g in groups:
        group_day_ids[g.id] = {r.ski_day_id for r in g.registrations}

    # Build person→Fahrtwunsch entries
    person_fahrtwunsch: dict[str, list[str]] = {}

    # Ride preferences: attribute to first member of group_a, reference #group_b_name
    # Track which pairs we've already emitted to avoid duplicates
    emitted_ride_pairs: set[tuple[str, str]] = set()
    for rp in ride_prefs:
        pair = (min(rp.group_a_id, rp.group_b_id), max(rp.group_a_id, rp.group_b_id))
        if pair in emitted_ride_pairs:
            continue
        emitted_ride_pairs.add(pair)
        ga = group_by_id.get(rp.group_a_id)
        gb = group_by_id.get(rp.group_b_id)
        if ga and gb and ga.members:
            person_id = ga.members[0].id
            person_fahrtwunsch.setdefault(person_id, []).append(f"#{gb.name}")

    # Person preferences: attribute to person_a, reference person_b full name
    emitted_person_pairs: set[tuple[str, str]] = set()
    for pp in person_prefs:
        pair = (min(pp.person_a_id, pp.person_b_id), max(pp.person_a_id, pp.person_b_id))
        if pair in emitted_person_pairs:
            continue
        emitted_person_pairs.add(pair)
        pa = person_by_id.get(pp.person_a_id)
        pb = person_by_id.get(pp.person_b_id)
        if pa and pb:
            person_fahrtwunsch.setdefault(pa.id, []).append(pb.full_name)

    # Write CSV
    output = io.StringIO()
    day_names = [d.name for d in days]
    header = ["first_name", "last_name", "Type", *day_names, "Busgruppe", "Fahrtwunsch"]
    writer = csv.writer(output)
    writer.writerow(header)

    for g in groups:
        for m in g.members:
            day_markers = []
            for d in days:
                if d.id in group_day_ids.get(g.id, set()):
                    if (m.id, d.id) in absent_set:
                        day_markers.append("")
                    else:
                        day_markers.append("x")
                else:
                    day_markers.append("")

            fahrtwunsch = ";".join(person_fahrtwunsch.get(m.id, []))
            writer.writerow([
                m.first_name,
                m.last_name,
                m.person_type.capitalize(),
                *day_markers,
                g.name,
                fahrtwunsch,
            ])

    return PlainTextResponse(content=output.getvalue(), media_type="text/csv")
