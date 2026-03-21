import { TestBed } from '@angular/core/testing';
import { SeatingGraphComponent } from './seating-graph.component';

describe('SeatingGraphComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeatingGraphComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(SeatingGraphComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render empty state when no groups', () => {
    const fixture = TestBed.createComponent(SeatingGraphComponent);
    fixture.componentInstance.groups = [];
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).toBeTruthy();
    const text = svg?.querySelector('text');
    expect(text?.textContent).toContain('No data to display');
  });

  it('should render nodes for groups', () => {
    const fixture = TestBed.createComponent(SeatingGraphComponent);
    fixture.componentInstance.groups = [
      { id: 'g1', season_id: 's1', name: 'Group 1', members: [{ id: 'p1', name: 'A', is_instructor: false, group_id: 'g1' }] },
      { id: 'g2', season_id: 's1', name: 'Group 2', members: [{ id: 'p2', name: 'B', is_instructor: true, group_id: 'g2' }] },
    ];
    fixture.componentInstance.seatingPlan = [{
      bus_name: 'A', bus_id: 'b1', capacity: 50, reserved_seats: 0,
      groups: [{ group_id: 'g1', group_name: 'Group 1', assignment_id: 'a1', members: [], is_instructor_group: false }],
    }];
    fixture.detectChanges();

    const circles = fixture.nativeElement.querySelectorAll('circle');
    expect(circles.length).toBe(2);
  });

  it('should render preference links', () => {
    const fixture = TestBed.createComponent(SeatingGraphComponent);
    fixture.componentInstance.groups = [
      { id: 'g1', season_id: 's1', name: 'G1', members: [{ id: 'p1', name: 'A', is_instructor: false, group_id: 'g1' }] },
      { id: 'g2', season_id: 's1', name: 'G2', members: [{ id: 'p2', name: 'B', is_instructor: false, group_id: 'g2' }] },
    ];
    fixture.componentInstance.preferences = [
      { id: 'pr1', season_id: 's1', group_a_id: 'g1', group_b_id: 'g2' },
    ];
    fixture.componentInstance.seatingPlan = [];
    fixture.detectChanges();

    const lines = fixture.nativeElement.querySelectorAll('line');
    expect(lines.length).toBe(1);
  });

  it('should color met preferences green and unmet red', () => {
    const fixture = TestBed.createComponent(SeatingGraphComponent);
    fixture.componentInstance.groups = [
      { id: 'g1', season_id: 's1', name: 'G1', members: [{ id: 'p1', name: 'A', is_instructor: false, group_id: 'g1' }] },
      { id: 'g2', season_id: 's1', name: 'G2', members: [{ id: 'p2', name: 'B', is_instructor: false, group_id: 'g2' }] },
      { id: 'g3', season_id: 's1', name: 'G3', members: [{ id: 'p3', name: 'C', is_instructor: false, group_id: 'g3' }] },
    ];
    fixture.componentInstance.preferences = [
      { id: 'pr1', season_id: 's1', group_a_id: 'g1', group_b_id: 'g2' },
      { id: 'pr2', season_id: 's1', group_a_id: 'g1', group_b_id: 'g3' },
    ];
    fixture.componentInstance.seatingPlan = [{
      bus_name: 'A', bus_id: 'b1', capacity: 50, reserved_seats: 0,
      groups: [
        { group_id: 'g1', group_name: 'G1', assignment_id: 'a1', members: [], is_instructor_group: false },
        { group_id: 'g2', group_name: 'G2', assignment_id: 'a2', members: [], is_instructor_group: false },
      ],
    }, {
      bus_name: 'B', bus_id: 'b2', capacity: 50, reserved_seats: 0,
      groups: [
        { group_id: 'g3', group_name: 'G3', assignment_id: 'a3', members: [], is_instructor_group: false },
      ],
    }];
    fixture.detectChanges();

    const lines = fixture.nativeElement.querySelectorAll('line');
    expect(lines.length).toBe(2);

    const colors = Array.from(lines).map((l: any) => l.getAttribute('stroke'));
    expect(colors).toContain('#4caf50'); // met (g1-g2 same bus)
    expect(colors).toContain('#f44336'); // unmet (g1-g3 different buses)
  });
});
