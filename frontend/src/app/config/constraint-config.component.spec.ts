import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { ConstraintConfigComponent } from './constraint-config.component';

describe('ConstraintConfigComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConstraintConfigComponent, NoopAnimationsModule],
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

  it('should load config on init', fakeAsync(() => {
    const fixture = TestBed.createComponent(ConstraintConfigComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/seasons/s1/config').flush({
      default_bus_capacity: 50,
      default_reserved_seats: 0,
      instructor_consistency: 100,
      passenger_consistency: 50,
      ride_together: 10,
      instructor_distribution: 75,
    });
    tick();

    const config = fixture.componentInstance.config();
    expect(config.instructor_consistency).toBe(100);
    expect(config.instructor_distribution).toBe(75);
  }));

  it('should have all four weight sliders', () => {
    const fixture = TestBed.createComponent(ConstraintConfigComponent);
    expect(fixture.componentInstance.sliders.length).toBe(4);
    expect(fixture.componentInstance.sliders.map(s => s.key)).toEqual([
      'instructor_consistency',
      'passenger_consistency',
      'ride_together',
      'instructor_distribution',
    ]);
  });

  it('should debounce saves on slider change', fakeAsync(() => {
    const fixture = TestBed.createComponent(ConstraintConfigComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/seasons/s1/config').flush({
      default_bus_capacity: 50, default_reserved_seats: 0,
      instructor_consistency: 100, passenger_consistency: 50,
      ride_together: 10, instructor_distribution: 75,
    });
    tick();

    fixture.componentInstance.onSliderChange('ride_together', 50);
    fixture.componentInstance.onSliderChange('ride_together', 55);
    fixture.componentInstance.onSliderChange('ride_together', 60);

    // No request yet (debounce)
    httpMock.expectNone(req => req.method === 'PUT');

    tick(500);

    // Only one request after debounce
    const req = httpMock.expectOne('/api/seasons/s1/config');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ ride_together: 60 });
    req.flush({
      default_bus_capacity: 50, default_reserved_seats: 0,
      instructor_consistency: 100, passenger_consistency: 50,
      ride_together: 60, instructor_distribution: 75,
    });
    tick();

    expect(fixture.componentInstance.config().ride_together).toBe(60);
  }));

  it('should reset to defaults', fakeAsync(() => {
    const fixture = TestBed.createComponent(ConstraintConfigComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/seasons/s1/config').flush({
      default_bus_capacity: 50, default_reserved_seats: 0,
      instructor_consistency: 200, passenger_consistency: 80,
      ride_together: 50, instructor_distribution: 120,
    });
    tick();

    fixture.componentInstance.resetDefaults();

    const req = httpMock.expectOne('/api/seasons/s1/config');
    expect(req.request.body.instructor_consistency).toBe(100);
    expect(req.request.body.passenger_consistency).toBe(50);
    expect(req.request.body.ride_together).toBe(10);
    expect(req.request.body.instructor_distribution).toBe(75);
    req.flush({
      default_bus_capacity: 50, default_reserved_seats: 0,
      instructor_consistency: 100, passenger_consistency: 50,
      ride_together: 10, instructor_distribution: 75,
    });
    tick();

    expect(fixture.componentInstance.config().instructor_consistency).toBe(100);
  }));
});
