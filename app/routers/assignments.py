from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.db import Assignment, Bus, Group, Registration, Season, SkiDay
from app.schemas.assignment import (
    AssignmentOverride,
    AssignmentRead,
    ConstraintConfigRead,
    ConstraintConfigUpdate,
    SeatingPlanEntry,
    SeatingPlanGroup,
    SeatingPlanPerson,
    SolveResultRead,
)
from app.models.db import ConstraintConfig
from app.services.assignment import persist_assignments, run_solver
from app.services.pdf_export import generate_seating_pdf

router = APIRouter(prefix="/api/seasons/{season_id}", tags=["assignments"])


# --- Constraint Config ---

@router.get("/config", response_model=ConstraintConfigRead)
def get_config(season_id: str, db: Session = Depends(get_db)):
    config = db.scalar(
        select(ConstraintConfig).where(ConstraintConfig.season_id == season_id)
    )
    if not config:
        return ConstraintConfigRead(
            instructor_consistency=100.0,
            passenger_consistency=50.0,
            ride_together=10.0,
            instructor_distribution=75.0,
        )
    return config


@router.put("/config", response_model=ConstraintConfigRead)
def update_config(season_id: str, body: ConstraintConfigUpdate, db: Session = Depends(get_db)):
    config = db.scalar(
        select(ConstraintConfig).where(ConstraintConfig.season_id == season_id)
    )
    if not config:
        config = ConstraintConfig(season_id=season_id)
        db.add(config)

    if body.instructor_consistency is not None:
        config.instructor_consistency = body.instructor_consistency
    if body.passenger_consistency is not None:
        config.passenger_consistency = body.passenger_consistency
    if body.ride_together is not None:
        config.ride_together = body.ride_together
    if body.instructor_distribution is not None:
        config.instructor_distribution = body.instructor_distribution

    db.commit()
    db.refresh(config)
    return config


# --- Solve ---

@router.post("/solve", response_model=SolveResultRead)
def solve_assignments(season_id: str, db: Session = Depends(get_db)):
    result = run_solver(db, season_id)
    persist_assignments(db, season_id, result)

    assignments_nested: dict[str, dict[str, str]] = defaultdict(dict)
    for (group_id, day_id), bus_name in result.assignments.items():
        assignments_nested[group_id][day_id] = bus_name

    return SolveResultRead(
        assignments=dict(assignments_nested),
        score=result.score,
        unmet_preferences=[list(pair) for pair in result.unmet_preferences],
    )


# --- Assignments CRUD ---

@router.get("/assignments", response_model=list[AssignmentRead])
def list_assignments(season_id: str, db: Session = Depends(get_db)):
    return db.scalars(
        select(Assignment)
        .join(Registration)
        .join(Group)
        .where(Group.season_id == season_id)
    ).all()


@router.put("/assignments/{assignment_id}", response_model=AssignmentRead)
def override_assignment(
    season_id: str, assignment_id: str, body: AssignmentOverride, db: Session = Depends(get_db)
):
    assignment = db.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(404, "Assignment not found")
    assignment.bus_id = body.bus_id
    db.commit()
    db.refresh(assignment)
    return assignment


@router.delete("/assignments", status_code=204)
def clear_assignments(season_id: str, db: Session = Depends(get_db)):
    assignments = db.scalars(
        select(Assignment)
        .join(Registration)
        .join(Group)
        .where(Group.season_id == season_id)
    ).all()
    for a in assignments:
        db.delete(a)
    db.commit()


# --- Seating Plan View ---

@router.get("/days/{day_id}/seating-plan", response_model=list[SeatingPlanEntry])
def get_seating_plan(season_id: str, day_id: str, db: Session = Depends(get_db)):
    day = db.get(SkiDay, day_id)
    if not day or day.season_id != season_id:
        raise HTTPException(404, "Day not found")

    buses = db.scalars(
        select(Bus)
        .where(Bus.ski_day_id == day_id)
        .options(
            selectinload(Bus.assignments)
            .selectinload(Assignment.registration)
            .selectinload(Registration.group)
            .selectinload(Group.members)
        )
    ).all()

    plan = []
    for bus in buses:
        groups = []
        for assignment in bus.assignments:
            group = assignment.registration.group
            groups.append(SeatingPlanGroup(
                group_id=group.id,
                group_name=group.name,
                assignment_id=assignment.id,
                is_instructor_group=any(m.is_instructor for m in group.members),
                members=[
                    SeatingPlanPerson(
                        person_id=m.id,
                        person_name=m.name,
                        is_instructor=m.is_instructor,
                    )
                    for m in group.members
                ],
            ))
        plan.append(SeatingPlanEntry(
            bus_name=bus.name,
            bus_id=bus.id,
            capacity=bus.capacity,
            reserved_seats=bus.reserved_seats,
            groups=groups,
        ))

    return plan


# --- PDF Export ---

@router.get("/export/pdf")
def export_pdf(season_id: str, db: Session = Depends(get_db)):
    season = db.get(Season, season_id)
    if not season:
        raise HTTPException(404, "Season not found")

    buf = generate_seating_pdf(db, season_id)
    filename = f"seating-plan-{season.name.replace(' ', '-')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
