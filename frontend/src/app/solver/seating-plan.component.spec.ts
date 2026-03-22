import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { SeatingPlanComponent } from './seating-plan.component';
import { SeatingPlanEntry } from '../core/models';

describe('SeatingPlanComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeatingPlanComponent, NoopAnimationsModule],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function makePlan(groups: { name: string; members: number; isInstructor?: boolean }[], capacity = 50, reserved = 0, busName = 'A', busId = 'b1'): SeatingPlanEntry {
    return {
      bus_name: busName,
      bus_id: busId,
      capacity,
      reserved_seats: reserved,
      groups: groups.map((g, i) => ({
        group_id: `g${i}`,
        group_name: g.name,
        assignment_id: `a${i}`,
        is_instructor_group: g.isInstructor || false,
        members: Array.from({ length: g.members }, (_, j) => ({
          person_id: `p${i}_${j}`,
          person_first_name: `Person`,
          person_last_name: `${j}`,
          person_type: (g.isInstructor ? 'lehrteam' : 'freifahrer') as 'freifahrer' | 'lehrteam',
          birth_year: null,
        })),
      })),
    };
  }

  it('should calculate occupancy correctly', () => {
    const fixture = TestBed.createComponent(SeatingPlanComponent);
    const component = fixture.componentInstance;
    const bus = makePlan([
      { name: 'G1', members: 3 },
      { name: 'G2', members: 4 },
    ]);
    expect(component.occupancy(bus)).toBe(7);
  });

  it('should calculate fill percentage with reserved seats', () => {
    const fixture = TestBed.createComponent(SeatingPlanComponent);
    const component = fixture.componentInstance;
    const bus = makePlan([{ name: 'G1', members: 9 }], 50, 5);
    // effective capacity = 45, occupancy = 9, fill = 20%
    expect(component.fillPercent(bus)).toBe(20);
  });

  it('should handle empty bus', () => {
    const fixture = TestBed.createComponent(SeatingPlanComponent);
    const component = fixture.componentInstance;
    const bus = makePlan([], 50);
    expect(component.occupancy(bus)).toBe(0);
    expect(component.fillPercent(bus)).toBe(0);
  });

  it('should handle full bus', () => {
    const fixture = TestBed.createComponent(SeatingPlanComponent);
    const component = fixture.componentInstance;
    const bus = makePlan([{ name: 'Full', members: 50 }], 50);
    expect(component.fillPercent(bus)).toBe(100);
  });

  it('should render bus cards', () => {
    const fixture = TestBed.createComponent(SeatingPlanComponent);
    fixture.componentInstance.plan = [
      makePlan([{ name: 'G1', members: 3 }], 50, 0, 'A', 'b1'),
      makePlan([{ name: 'G2', members: 2, isInstructor: true }], 50, 0, 'B', 'b2'),
    ];
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.bus-card');
    expect(cards.length).toBe(2);
  });

  it('should highlight instructor groups', () => {
    const fixture = TestBed.createComponent(SeatingPlanComponent);
    fixture.componentInstance.plan = [
      makePlan([
        { name: 'Normal', members: 2 },
        { name: 'Instructors', members: 1, isInstructor: true },
      ]),
    ];
    fixture.detectChanges();

    const instructorGroups = fixture.nativeElement.querySelectorAll('.instructor-group');
    expect(instructorGroups.length).toBe(1);
  });

  it('should return other buses for move target', () => {
    const fixture = TestBed.createComponent(SeatingPlanComponent);
    const component = fixture.componentInstance;
    component.plan = [
      makePlan([{ name: 'G1', members: 2 }], 50, 0, 'Bus A', 'b1'),
      makePlan([{ name: 'G2', members: 3 }], 50, 0, 'Bus B', 'b2'),
      makePlan([], 50, 0, 'Bus C', 'b3'),
    ];

    const targets = component.otherBuses('b1');
    expect(targets.length).toBe(2);
    expect(targets.map(t => t.bus_name)).toEqual(['Bus B', 'Bus C']);
  });

  it('should call override API when moving a group', fakeAsync(() => {
    const fixture = TestBed.createComponent(SeatingPlanComponent);
    const component = fixture.componentInstance;
    component.seasonId = 's1';
    component.plan = [
      makePlan([{ name: 'G1', members: 2 }], 50, 0, 'Bus A', 'b1'),
      makePlan([], 50, 0, 'Bus B', 'b2'),
    ];

    spyOn(component.assignmentChanged, 'emit');
    const group = component.plan[0].groups[0];
    component.moveGroup(group, 'b2');

    const req = httpMock.expectOne(r =>
      r.method === 'PUT' && r.url === '/api/seasons/s1/assignments/a0'
    );
    expect(req.request.body).toEqual({ bus_id: 'b2' });
    req.flush({ id: 'a0', registration_id: 'r0', bus_id: 'b2' });
    tick();

    expect(component.assignmentChanged.emit).toHaveBeenCalled();
  }));
});
