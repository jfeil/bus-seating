from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.db import Assignment, Bus, ConstraintConfig, Group, Person, PersonAbsence, PersonPreference, Registration, RidePreference, SkiDay
from app.solver.converter import buses_to_solver, config_to_weights, groups_to_solver
from app.solver.engine import solve
from app.solver.types import SolverResult


def run_solver(db: Session, season_id: str) -> SolverResult:
    groups = _load_groups(db, season_id)
    buses = _load_all_buses(db, season_id)
    preferences = db.scalars(
        select(RidePreference).where(RidePreference.season_id == season_id)
    ).all()
    person_preferences = db.scalars(
        select(PersonPreference)
        .where(PersonPreference.season_id == season_id)
        .options(
            selectinload(PersonPreference.person_a),
            selectinload(PersonPreference.person_b),
        )
    ).all()
    person_absences = db.scalars(
        select(PersonAbsence)
        .join(Person)
        .join(Group)
        .where(Group.season_id == season_id)
    ).all()
    config = db.scalar(
        select(ConstraintConfig).where(ConstraintConfig.season_id == season_id)
    )

    solver_groups = groups_to_solver(
        list(groups), list(preferences), list(person_preferences), list(person_absences)
    )
    solver_buses = buses_to_solver(list(buses))
    weights = config_to_weights(config)

    return solve(solver_groups, solver_buses, weights)


def persist_assignments(db: Session, season_id: str, result: SolverResult) -> None:
    _clear_existing_assignments(db, season_id)

    registrations = _load_registrations(db, season_id)
    reg_lookup = {(r.group_id, r.ski_day_id): r for r in registrations}

    buses = _load_all_buses(db, season_id)
    bus_lookup = {(b.ski_day_id, b.name): b for b in buses}

    for (group_id, day_id), bus_name in result.assignments.items():
        registration = reg_lookup.get((group_id, day_id))
        bus = bus_lookup.get((day_id, bus_name))
        if registration and bus:
            db.add(Assignment(registration_id=registration.id, bus_id=bus.id))

    db.commit()


def _clear_existing_assignments(db: Session, season_id: str) -> None:
    registrations = _load_registrations(db, season_id)
    reg_ids = [r.id for r in registrations]
    if reg_ids:
        db.execute(
            Assignment.__table__.delete().where(Assignment.registration_id.in_(reg_ids))
        )


def _load_groups(db: Session, season_id: str) -> list[Group]:
    return list(db.scalars(
        select(Group)
        .where(Group.season_id == season_id)
        .options(selectinload(Group.members), selectinload(Group.registrations))
    ).all())


def _load_all_buses(db: Session, season_id: str) -> list[Bus]:
    return list(db.scalars(
        select(Bus)
        .join(SkiDay)
        .where(SkiDay.season_id == season_id)
    ).all())


def _load_registrations(db: Session, season_id: str) -> list[Registration]:
    return list(db.scalars(
        select(Registration)
        .join(Group)
        .where(Group.season_id == season_id)
    ).all())
