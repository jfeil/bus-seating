import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { DayListComponent } from './day-list.component';

describe('DayListComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DayListComponent, NoopAnimationsModule],
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

  it('should load days on init', fakeAsync(() => {
    const fixture = TestBed.createComponent(DayListComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/seasons/s1/days').flush([
      { id: 'd1', season_id: 's1', name: 'Day 1', date: '2026-01-10' },
    ]);
    httpMock.expectOne('/api/seasons/s1/days/d1/buses').flush([]);
    tick();
    fixture.detectChanges();

    expect(fixture.componentInstance.days().length).toBe(1);
  }));

  it('should add a day and reload', fakeAsync(() => {
    const fixture = TestBed.createComponent(DayListComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/seasons/s1/days').flush([]);
    tick();

    fixture.componentInstance.newDayName = 'Day 2';
    fixture.componentInstance.newDayDate = '2026-01-11';
    fixture.componentInstance.addDay();

    const req = httpMock.expectOne(r => r.method === 'POST' && r.url === '/api/seasons/s1/days');
    expect(req.request.body.name).toBe('Day 2');
    expect(req.request.body.date).toBe('2026-01-11');
    req.flush({ id: 'd2', season_id: 's1', name: 'Day 2', date: '2026-01-11' });
    tick();

    httpMock.expectOne('/api/seasons/s1/days').flush([
      { id: 'd2', season_id: 's1', name: 'Day 2', date: '2026-01-11' },
    ]);
    httpMock.expectOne('/api/seasons/s1/days/d2/buses').flush([]);
    tick();

    expect(fixture.componentInstance.days().length).toBe(1);
    expect(fixture.componentInstance.newDayName).toBe('');
  }));

  it('should auto-name day when name is empty', fakeAsync(() => {
    const fixture = TestBed.createComponent(DayListComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/seasons/s1/days').flush([
      { id: 'd1', season_id: 's1', name: 'Day 1', date: null },
    ]);
    httpMock.expectOne('/api/seasons/s1/days/d1/buses').flush([]);
    tick();

    fixture.componentInstance.newDayName = '';
    fixture.componentInstance.addDay();

    const req = httpMock.expectOne(r => r.method === 'POST' && r.url === '/api/seasons/s1/days');
    expect(req.request.body.name).toBe('Day 2');
    req.flush({ id: 'd2', season_id: 's1', name: 'Day 2', date: null });
    tick();

    httpMock.expectOne('/api/seasons/s1/days').flush([]);
    tick();
  }));

  it('should add a bus to a day', fakeAsync(() => {
    const fixture = TestBed.createComponent(DayListComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/seasons/s1/days').flush([
      { id: 'd1', season_id: 's1', name: 'Day 1', date: null },
    ]);
    httpMock.expectOne('/api/seasons/s1/days/d1/buses').flush([]);
    tick();

    fixture.componentInstance.newBusNames['d1'] = 'Bus A';
    fixture.componentInstance.newBusCapacities['d1'] = 48;
    fixture.componentInstance.newBusReserved['d1'] = 2;
    fixture.componentInstance.addBus('d1');

    const req = httpMock.expectOne(r => r.method === 'POST' && r.url === '/api/seasons/s1/days/d1/buses');
    expect(req.request.body).toEqual({ name: 'Bus A', capacity: 48, reserved_seats: 2 });
    req.flush({ id: 'b1', ski_day_id: 'd1', name: 'Bus A', capacity: 48, reserved_seats: 2 });
    tick();

    httpMock.expectOne('/api/seasons/s1/days/d1/buses').flush([
      { id: 'b1', ski_day_id: 'd1', name: 'Bus A', capacity: 48, reserved_seats: 2 },
    ]);
    tick();

    expect(fixture.componentInstance.getBuses('d1').length).toBe(1);
  }));

  it('should remove a bus', fakeAsync(() => {
    const fixture = TestBed.createComponent(DayListComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/seasons/s1/days').flush([
      { id: 'd1', season_id: 's1', name: 'Day 1', date: null },
    ]);
    httpMock.expectOne('/api/seasons/s1/days/d1/buses').flush([
      { id: 'b1', ski_day_id: 'd1', name: 'Bus A', capacity: 50, reserved_seats: 0 },
    ]);
    tick();

    fixture.componentInstance.removeBus('d1', 'b1');

    const req = httpMock.expectOne(r => r.method === 'DELETE' && r.url === '/api/seasons/s1/days/d1/buses/b1');
    req.flush(null);
    tick();

    httpMock.expectOne('/api/seasons/s1/days/d1/buses').flush([]);
    tick();

    expect(fixture.componentInstance.getBuses('d1').length).toBe(0);
  }));

  it('should display buses for each day', fakeAsync(() => {
    const fixture = TestBed.createComponent(DayListComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/seasons/s1/days').flush([
      { id: 'd1', season_id: 's1', name: 'Day 1', date: null },
    ]);
    httpMock.expectOne('/api/seasons/s1/days/d1/buses').flush([
      { id: 'b1', ski_day_id: 'd1', name: 'Bus A', capacity: 50, reserved_seats: 0 },
      { id: 'b2', ski_day_id: 'd1', name: 'Bus B', capacity: 40, reserved_seats: 5 },
    ]);
    tick();
    fixture.detectChanges();

    expect(fixture.componentInstance.getBuses('d1').length).toBe(2);
    const cards = fixture.nativeElement.querySelectorAll('.day-card');
    expect(cards.length).toBe(1);
  }));
});
