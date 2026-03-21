# Architecture

## Overview

Bus seating assignment tool for ski trips. Assigns groups of participants to buses across multiple ski days, optimizing for configurable constraints (consistency, ride-together preferences, instructor distribution).

The core problem is **graph partitioning**: groups form nodes, ride-together preferences form edges, and buses are partitions with capacity constraints.

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Backend  | Python (FastAPI), SQLAlchemy, SQLite |
| Frontend | Angular 19 (standalone components, signals), Angular Material, D3.js |
| Package  | uv (Python), npm (Node 24 LTS)     |
| Testing  | pytest (backend), Karma + Jasmine (frontend) |
| Deploy   | Desktop app (Electron, planned)     |

## System Architecture

```
┌─────────────────────────────────────┐
│           Angular Frontend          │
│  Seasons │ Days │ Groups │ Solver   │
│         D3.js Graph Visualization   │
└──────────────┬──────────────────────┘
               │ HTTP (proxy :4200 → :8000)
┌──────────────▼──────────────────────┐
│           FastAPI Backend           │
│  Routers → Services → Solver       │
│              │                      │
│         SQLAlchemy ORM              │
└──────────────┬──────────────────────┘
               │
         ┌─────▼─────┐
         │   SQLite   │
         └───────────┘
```

Single-user desktop app — SQLite with `StaticPool` is sufficient. No auth layer needed.

## Backend Structure

```
app/
├── config.py           # pydantic-settings, BUS_SEATING_ env prefix
├── database.py         # Engine, session factory, get_db(), init_db()
├── main.py             # FastAPI app, CORS, lifespan, router includes
├── models/
│   └── db.py           # All ORM models (~130 lines, single file)
├── schemas/            # Pydantic v2 request/response schemas
│   ├── season.py
│   ├── day.py
│   ├── bus.py
│   ├── group.py        # GroupCreate accepts members + register_for_days
│   └── assignment.py   # SeatingPlanEntry, SolveResultRead, ConstraintConfigUpdate
├── routers/            # FastAPI route handlers
│   ├── seasons.py
│   ├── days.py
│   ├── buses.py        # Includes reserved_seats
│   ├── groups.py       # Groups, persons, registrations, ride-preferences
│   └── assignments.py  # Config, solve, assignments CRUD, seating plan
├── services/
│   └── assignment.py   # Orchestrates: load DB → convert → solve → persist
└── solver/
    ├── types.py        # Pure dataclasses (no DB dependency)
    ├── engine.py       # Core algorithm
    └── converter.py    # DB models ↔ solver types bridge
```

### Key Design Decisions

**Pure solver function**: The solver (`app/solver/`) uses only plain dataclasses for input/output. No SQLAlchemy, no Pydantic, no side effects. The `converter.py` module bridges between DB models and solver types. This keeps the solver independently testable and reusable.

**Single ORM file**: All models live in `app/models/db.py`. At ~130 lines, splitting would add complexity without benefit.

**Bus identity by name**: Buses are per-day entities (different days can have different bus counts/capacities). Cross-day consistency is tracked by bus *name*, not foreign key. This matches the real-world model where "Bus A" on Monday is conceptually the same as "Bus A" on Tuesday, even though they might differ in capacity.

**Group as atomic unit**: A `Group` (typically a family) is never split across buses. `Person` entities exist within groups but the solver operates at group granularity. This simplifies the problem from O(persons) to O(groups).

## Solver Algorithm

Two-phase approach: greedy construction + local search refinement.

### Phase 1: Greedy Assignment

1. **Order days** by constraint pressure (days with fewer buses or more groups first)
2. **For each day**, sort groups for placement:
   - Instructors first (they act as "bus seeds")
   - Then by group size descending (largest groups first — harder to place later)
3. **Score each bus** for each group considering:
   - Previous-day assignments (consistency bonus)
   - Ride-together preferences (if preferred groups already assigned to this bus)
   - Instructor distribution (penalize buses that already have many instructors)
   - Capacity feasibility
4. **Place group** on highest-scoring bus

### Phase 2: Local Search Improvement

Iteratively attempts:
- **Swaps**: Exchange two groups between buses (if both fit)
- **Moves**: Relocate a single group to a different bus (if it fits)

Each candidate is evaluated using `_compute_group_score`, which includes both consistency and ride-together preferences. Accept only improvements.

### Constraint Weights (Configurable)

| Weight                    | Default | Purpose |
|---------------------------|---------|---------|
| `instructor_consistency`  | 100     | Keep instructors on same bus across days |
| `passenger_consistency`   | 50      | Keep regular groups on same bus across days |
| `ride_together`           | 10      | Honor ride-together preferences |
| `instructor_distribution` | 75      | Spread instructors evenly across buses |

### Fill Strategy

**Fill-first, not balanced.** Buses are packed as full as possible (respecting `reserved_seats` buffer). This makes late-joiner additions easier — there's typically one bus with space rather than all buses partially full.

## Data Model

```
Season
 └─ SkiDay
     └─ Bus (capacity, reserved_seats)

Season
 └─ Group
     └─ Person (is_instructor)
     └─ Registration (links group to ski day)

Season
 └─ RidePreference (group_a ↔ group_b, bidirectional)
 └─ ConstraintConfig (4 weight sliders)

SkiDay + Bus + Group
 └─ Assignment (solver output)
```

## Frontend Structure

```
frontend/src/app/
├── core/
│   ├── models.ts         # TypeScript interfaces (mirrors backend schemas)
│   └── api.service.ts    # Single service wrapping all ~25 endpoints
├── seasons/
│   ├── season-list.component.ts    # Landing: season cards + create
│   └── season-detail.component.ts  # Layout shell with sidenav
├── days/
│   └── day-list.component.ts       # Master-detail: days + buses
├── groups/
│   └── group-list.component.ts     # Groups, members, preferences, CSV import
├── config/
│   └── constraint-config.component.ts  # 4 sliders, debounced save, reset
└── solver/
    ├── solver-panel.component.ts       # Solve button, score, tabs per day
    ├── seating-plan.component.ts       # Bus cards with capacity bars
    └── seating-graph.component.ts      # D3 force-directed graph
```

### Key Frontend Decisions

**Angular 19 standalone components with signals**: No NgModules. All components are standalone with signal-based state. This is the modern Angular pattern.

**Single API service**: All HTTP calls go through `ApiService`. No per-feature services — the app is small enough that one service keeps things simple.

**D3.js for graph visualization**: Force-directed layout with nodes sized by group member count, colored by bus assignment. Preference links are green (met) or red/dashed (unmet). Supports drag interaction and has animated transitions.

**Debounced constraint sliders**: Slider changes are debounced (500ms) before auto-saving to backend. Multiple rapid adjustments result in a single PUT request.

**Dev proxy**: `proxy.conf.json` forwards `/api` requests from Angular dev server (port 4200) to FastAPI (port 8000).

## Testing Strategy

**TDD (Uncle Bob style)**: Tests written before implementation.

- **Backend**: pytest with in-memory SQLite (`StaticPool`). 53 tests covering solver logic (36 tests across 8 test classes) and API integration (17 tests).
- **Frontend**: Karma + Jasmine with `ChromeHeadlessNoSandbox`. 34 tests covering API service, components, and rendering.
- **Solver tests are isolated**: They use pure dataclasses, no DB, no HTTP. Fast and deterministic.
- **API tests use real DB**: In-memory SQLite with `StaticPool` and `check_same_thread=False`. Full request/response cycle through FastAPI TestClient.
