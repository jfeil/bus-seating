import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { SolverPanelComponent } from './solver-panel.component';

describe('SolverPanelComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SolverPanelComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { parent: { snapshot: { params: { seasonId: 's1' } } } },
        },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function flushInit() {
    httpMock.expectOne('/api/seasons/s1/days').flush([
      { id: 'd1', season_id: 's1', name: 'Day 1', date: null },
    ]);
    httpMock.expectOne('/api/seasons/s1/groups').flush([
      { id: 'g1', season_id: 's1', name: 'G1', members: [{ id: 'p1', first_name: 'A', last_name: 'X', person_type: 'freifahrer' as const, birth_year: null, group_id: 'g1' }] },
    ]);
    httpMock.expectOne('/api/seasons/s1/ride-preferences').flush([]);
    httpMock.expectOne('/api/seasons/s1/days/d1/seating-plan').flush([]);
    httpMock.expectOne('/api/seasons/s1/days/d1/buses').flush([
      { id: 'b1', ski_day_id: 'd1', name: 'Bus A', capacity: 50, reserved_seats: 0 },
    ]);
  }

  it('should load data on init', fakeAsync(() => {
    const fixture = TestBed.createComponent(SolverPanelComponent);
    fixture.detectChanges();
    flushInit();
    tick();

    expect(fixture.componentInstance.days().length).toBe(1);
    expect(fixture.componentInstance.groups().length).toBe(1);
  }));

  it('should run solver and display results', fakeAsync(() => {
    const fixture = TestBed.createComponent(SolverPanelComponent);
    fixture.detectChanges();
    flushInit();
    tick();

    expect(fixture.componentInstance.solving()).toBe(false);
    fixture.componentInstance.runSolver();
    expect(fixture.componentInstance.solving()).toBe(true);

    const req = httpMock.expectOne(r => r.method === 'POST' && r.url === '/api/seasons/s1/solve');
    req.flush({
      assignments: { d1: { g1: 'b1' } },
      score: 42.5,
      unmet_preferences: [],
    });
    tick();

    // Reload seating plans after solve
    httpMock.expectOne('/api/seasons/s1/days/d1/seating-plan').flush([{
      bus_name: 'Bus A', bus_id: 'b1', capacity: 50, reserved_seats: 0,
      groups: [{ group_id: 'g1', group_name: 'G1', members: [{ person_id: 'p1', person_first_name: 'A', person_last_name: 'X', person_type: 'freifahrer' as const, birth_year: null }], is_instructor_group: false }],
    }]);
    tick();

    expect(fixture.componentInstance.solving()).toBe(false);
    expect(fixture.componentInstance.lastResult()!.score).toBe(42.5);
    expect(fixture.componentInstance.lastResult()!.unmet_preferences.length).toBe(0);
  }));

  it('should show unmet preferences count', fakeAsync(() => {
    const fixture = TestBed.createComponent(SolverPanelComponent);
    fixture.detectChanges();
    flushInit();
    tick();

    fixture.componentInstance.runSolver();
    httpMock.expectOne(r => r.method === 'POST').flush({
      assignments: {},
      score: 10,
      unmet_preferences: [['g1', 'g2']],
    });
    tick();
    httpMock.expectOne('/api/seasons/s1/days/d1/seating-plan').flush([]);
    tick();
    fixture.detectChanges();

    expect(fixture.componentInstance.lastResult()!.unmet_preferences.length).toBe(1);
  }));

  it('should clear assignments', fakeAsync(() => {
    const fixture = TestBed.createComponent(SolverPanelComponent);
    fixture.detectChanges();
    flushInit();
    tick();

    // First solve
    fixture.componentInstance.runSolver();
    httpMock.expectOne(r => r.method === 'POST').flush({
      assignments: {}, score: 10, unmet_preferences: [],
    });
    tick();
    httpMock.expectOne('/api/seasons/s1/days/d1/seating-plan').flush([]);
    tick();

    expect(fixture.componentInstance.lastResult()).toBeTruthy();

    // Clear — bypass confirm dialog
    spyOn(window, 'confirm').and.returnValue(true);
    fixture.componentInstance.clearAll();

    httpMock.expectOne(r => r.method === 'DELETE' && r.url === '/api/seasons/s1/assignments').flush(null);
    tick();

    expect(fixture.componentInstance.lastResult()).toBeNull();
  }));

  it('should handle solver error gracefully', fakeAsync(() => {
    const fixture = TestBed.createComponent(SolverPanelComponent);
    fixture.detectChanges();
    flushInit();
    tick();

    fixture.componentInstance.runSolver();
    expect(fixture.componentInstance.solving()).toBe(true);

    httpMock.expectOne(r => r.method === 'POST').flush('Server error', { status: 500, statusText: 'Error' });
    tick();

    expect(fixture.componentInstance.solving()).toBe(false);
    expect(fixture.componentInstance.lastResult()).toBeNull();
  }));
});
