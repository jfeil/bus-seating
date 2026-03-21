# Plan

## Project Goal

Replace a manual Excel-based process for assigning ski trip participants to buses. Built for a single organizer (desktop app), not a multi-user web service.

## Design Decisions Log

### Problem Modeling

- **Graph partitioning framing**: Groups are nodes, ride-together preferences are edges, buses are partitions. This maps cleanly to the real-world problem.
- **Groups as atomic units**: Families (parents + kids) must never be split. The solver works at group granularity, not individual person level. Persons exist for headcount and instructor tracking.
- **Instructor groups**: A group is marked as an instructor group (all members are instructors). Instructors get higher consistency priority and are spread evenly across buses.

### Algorithm

- **Two-phase greedy + local search**: Greedy construction provides a good initial solution; local search (swaps + moves) refines it. No need for OR-Tools or ILP at this scale (typically <100 groups, <10 buses, <5 days).
- **Instructor-first placement**: Instructors are placed first as "bus seeds" to ensure even distribution. Without this, fill-first strategy would cluster everyone on the same buses.
- **Fill-first (not balanced)**: Buses are packed as full as possible. This leaves slack on the last bus for late joiners, which matches the organizer's real-world needs.
- **Day ordering by pressure**: Days with fewer buses or more groups are solved first, giving the hardest constraints the most freedom.
- **Bus identity by name**: Cross-day consistency uses bus names (e.g., "Bus A"), not database foreign keys. Different days can have different bus counts and capacities.
- **Configurable weights**: All four constraint weights are exposed in the UI so the end user can experiment with trade-offs without touching code.

### Data Model

- **Season as top-level entity**: Everything is scoped to a season (typically one ski trip). Seasons contain days, groups, preferences, and config.
- **Per-day buses**: Each ski day has its own set of buses with independent capacity and reserved seats. This handles the real scenario where bus availability varies by day.
- **Reserved seats buffer**: Each bus has a configurable `reserved_seats` count subtracted from capacity. Allows keeping seats free for last-minute additions.
- **Bidirectional preferences**: A ride-together preference between group A and group B is stored once and applies in both directions.
- **Constraint config per season**: Each season stores its own weight configuration, so different trips can have different tuning.

### Tech Stack

- **FastAPI + SQLite**: Lightweight, no external DB server needed. Perfect for a single-user desktop app. SQLite with `StaticPool` for shared in-memory testing.
- **Angular 19 standalone + signals**: Modern Angular without NgModule boilerplate. Signals for reactive state.
- **D3.js for visualization**: Force-directed graph showing bus assignments and preference satisfaction. Animated transitions when re-solving.
- **uv for Python packaging**: Fast, modern Python package manager.
- **Node 24 LTS**: Current LTS version (since October 2025).
- **Electron (planned)**: Desktop deployment target. Not yet implemented.

### API Design

- **REST with nested routes**: `/api/seasons/{id}/days/{id}/buses/{id}` — reflects the containment hierarchy.
- **Solve endpoint returns full result**: `POST /api/seasons/{id}/solve` runs the solver and returns the complete seating plan + score in one response.
- **Seating plan as view**: `GET /api/seasons/{id}/seating-plan` returns a denormalized view grouping assignments by day and bus, ready for UI consumption.
- **Config PATCH semantics**: `PUT /api/seasons/{id}/config` accepts partial updates (only changed weights). Frontend debounces slider changes (500ms) to avoid excessive requests.

### Frontend UX

- **Sidenav navigation**: Season detail page has four sections: Days & Buses, Groups & People, Solver Config, Solve & Results.
- **CSV import**: Groups can be bulk-imported via CSV paste (textarea, not file upload). Format: `group_name,member_name,is_instructor`.
- **Inline editing**: Bus capacity and reserved seats are editable inline. Day registration is toggled via checkboxes.
- **Graph + table dual view**: Solver results shown as both a force-directed graph (visual) and bus cards with member lists (detailed). Tabs switch between days.
- **Manual override**: After solving, individual group assignments can be changed via the UI. The override is persisted without re-running the solver.

### Testing

- **TDD throughout**: Tests written before implementation, Uncle Bob style.
- **Pure solver tests**: Solver tested with plain dataclasses, no DB or HTTP involved. Fast, deterministic, easy to reason about.
- **API integration tests**: Full round-trip through FastAPI TestClient with in-memory SQLite.
- **Frontend component tests**: Karma + Jasmine with `HttpTestingController` for HTTP mocking.

## Status

### Done

- [x] Solver engine with all constraint types
- [x] Full REST API (seasons, days, buses, groups, persons, registrations, preferences, assignments, config)
- [x] Backend tests (53 passing)
- [x] Angular frontend (all components: seasons, days, groups, config, solver, graph, seating plan)
- [x] Frontend tests (34 passing)
- [x] D3.js graph visualization

### Remaining

- [ ] CSV import implementation (UI exists, parsing logic needed)
- [ ] Manual assignment override UI (API exists)
- [ ] Animated transitions on re-solve
- [ ] Electron packaging for desktop deployment
- [ ] End-to-end testing
- [ ] Error handling and loading states polish
