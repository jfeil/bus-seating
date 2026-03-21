import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('Seasons', () => {
    it('should fetch seasons', () => {
      service.getSeasons().subscribe(seasons => {
        expect(seasons.length).toBe(1);
        expect(seasons[0].name).toBe('Winter 2026');
      });
      const req = httpMock.expectOne('/api/seasons');
      expect(req.request.method).toBe('GET');
      req.flush([{ id: '1', name: 'Winter 2026' }]);
    });

    it('should create a season', () => {
      service.createSeason('New Season').subscribe(s => {
        expect(s.name).toBe('New Season');
      });
      const req = httpMock.expectOne('/api/seasons');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'New Season' });
      req.flush({ id: '1', name: 'New Season' });
    });

    it('should delete a season', () => {
      service.deleteSeason('1').subscribe();
      const req = httpMock.expectOne('/api/seasons/1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('Days', () => {
    it('should fetch days for a season', () => {
      service.getDays('s1').subscribe(days => {
        expect(days.length).toBe(2);
      });
      const req = httpMock.expectOne('/api/seasons/s1/days');
      expect(req.request.method).toBe('GET');
      req.flush([
        { id: 'd1', season_id: 's1', name: 'Day 1', date: null },
        { id: 'd2', season_id: 's1', name: 'Day 2', date: null },
      ]);
    });

    it('should create a day', () => {
      service.createDay('s1', 'Day 1', '2026-01-15').subscribe(d => {
        expect(d.name).toBe('Day 1');
      });
      const req = httpMock.expectOne('/api/seasons/s1/days');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'Day 1', date: '2026-01-15' });
      req.flush({ id: 'd1', season_id: 's1', name: 'Day 1', date: '2026-01-15' });
    });
  });

  describe('Buses', () => {
    it('should create a bus with reserved seats', () => {
      service.createBus('s1', 'd1', { name: 'A', capacity: 50, reserved_seats: 5 }).subscribe(b => {
        expect(b.reserved_seats).toBe(5);
      });
      const req = httpMock.expectOne('/api/seasons/s1/days/d1/buses');
      expect(req.request.method).toBe('POST');
      expect(req.request.body.reserved_seats).toBe(5);
      req.flush({ id: 'b1', ski_day_id: 'd1', name: 'A', capacity: 50, reserved_seats: 5 });
    });
  });

  describe('Groups', () => {
    it('should create a group with members and day registration', () => {
      const data = {
        name: 'Familie Mueller',
        members: [{ name: 'Hans' }, { name: 'Anna', is_instructor: true }],
        register_for_days: ['d1', 'd2'],
      };
      service.createGroup('s1', data).subscribe(g => {
        expect(g.members.length).toBe(2);
      });
      const req = httpMock.expectOne('/api/seasons/s1/groups');
      expect(req.request.method).toBe('POST');
      expect(req.request.body.register_for_days).toEqual(['d1', 'd2']);
      req.flush({
        id: 'g1', season_id: 's1', name: 'Familie Mueller',
        members: [
          { id: 'p1', name: 'Hans', is_instructor: false, group_id: 'g1' },
          { id: 'p2', name: 'Anna', is_instructor: true, group_id: 'g1' },
        ],
      });
    });
  });

  describe('Config', () => {
    it('should fetch default config', () => {
      service.getConfig('s1').subscribe(c => {
        expect(c.instructor_consistency).toBe(100);
        expect(c.instructor_distribution).toBe(75);
      });
      const req = httpMock.expectOne('/api/seasons/s1/config');
      req.flush({
        instructor_consistency: 100,
        passenger_consistency: 50,
        ride_together: 10,
        instructor_distribution: 75,
      });
    });

    it('should update config partially', () => {
      service.updateConfig('s1', { ride_together: 50 }).subscribe(c => {
        expect(c.ride_together).toBe(50);
      });
      const req = httpMock.expectOne('/api/seasons/s1/config');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ ride_together: 50 });
      req.flush({
        instructor_consistency: 100,
        passenger_consistency: 50,
        ride_together: 50,
        instructor_distribution: 75,
      });
    });
  });

  describe('Solver', () => {
    it('should call solve endpoint', () => {
      service.solve('s1').subscribe(result => {
        expect(result.score).toBe(42);
        expect(result.unmet_preferences.length).toBe(0);
      });
      const req = httpMock.expectOne('/api/seasons/s1/solve');
      expect(req.request.method).toBe('POST');
      req.flush({ assignments: {}, score: 42, unmet_preferences: [] });
    });

    it('should fetch seating plan', () => {
      service.getSeatingPlan('s1', 'd1').subscribe(plan => {
        expect(plan.length).toBe(1);
        expect(plan[0].bus_name).toBe('A');
      });
      const req = httpMock.expectOne('/api/seasons/s1/days/d1/seating-plan');
      req.flush([{
        bus_name: 'A', bus_id: 'b1', capacity: 50, reserved_seats: 0,
        groups: [{ group_id: 'g1', group_name: 'Test', members: [], is_instructor_group: false }],
      }]);
    });

    it('should override an assignment', () => {
      service.overrideAssignment('s1', 'a1', 'b2').subscribe(a => {
        expect(a.bus_id).toBe('b2');
      });
      const req = httpMock.expectOne('/api/seasons/s1/assignments/a1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ bus_id: 'b2' });
      req.flush({ id: 'a1', registration_id: 'r1', bus_id: 'b2' });
    });
  });

  describe('Ride Preferences', () => {
    it('should create a ride preference', () => {
      service.createRidePreference('s1', 'g1', 'g2').subscribe(p => {
        expect(p.group_a_id).toBe('g1');
      });
      const req = httpMock.expectOne('/api/seasons/s1/ride-preferences');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ group_a_id: 'g1', group_b_id: 'g2' });
      req.flush({ id: 'p1', season_id: 's1', group_a_id: 'g1', group_b_id: 'g2' });
    });
  });
});
