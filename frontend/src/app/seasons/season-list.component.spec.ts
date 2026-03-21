import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { SeasonListComponent } from './season-list.component';

describe('SeasonListComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeasonListComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => httpMock.verify());

  it('should load and display seasons on init', fakeAsync(() => {
    const fixture = TestBed.createComponent(SeasonListComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/seasons').flush([
      { id: '1', name: 'Winter 2026' },
      { id: '2', name: 'Winter 2027' },
    ]);
    tick();
    fixture.detectChanges();

    expect(fixture.componentInstance.seasons().length).toBe(2);
    const cards = fixture.nativeElement.querySelectorAll('mat-card');
    expect(cards.length).toBe(2);
  }));

  it('should create a season and reload', fakeAsync(() => {
    const fixture = TestBed.createComponent(SeasonListComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/seasons').flush([]);
    tick();

    fixture.componentInstance.newName = 'Test Season';
    fixture.componentInstance.create();

    const createReq = httpMock.expectOne(req => req.method === 'POST' && req.url === '/api/seasons');
    expect(createReq.request.body.name).toBe('Test Season');
    createReq.flush({ id: '1', name: 'Test Season' });
    tick();

    httpMock.expectOne('/api/seasons').flush([{ id: '1', name: 'Test Season' }]);
    tick();
    fixture.detectChanges();

    expect(fixture.componentInstance.seasons().length).toBe(1);
    expect(fixture.componentInstance.newName).toBe('');
  }));

  it('should not create season with empty name', fakeAsync(() => {
    const fixture = TestBed.createComponent(SeasonListComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/seasons').flush([]);
    tick();

    fixture.componentInstance.newName = '   ';
    fixture.componentInstance.create();

    httpMock.expectNone(req => req.method === 'POST');
  }));

  it('should navigate to season on click', fakeAsync(() => {
    spyOn(router, 'navigate');
    const fixture = TestBed.createComponent(SeasonListComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/seasons').flush([]);
    tick();

    fixture.componentInstance.open({ id: 'abc', name: 'Test' });
    expect(router.navigate).toHaveBeenCalledWith(['/seasons', 'abc', 'days']);
  }));

  it('should show empty state when no seasons', fakeAsync(() => {
    const fixture = TestBed.createComponent(SeasonListComponent);
    fixture.detectChanges();
    httpMock.expectOne('/api/seasons').flush([]);
    tick();
    fixture.detectChanges();

    const emptyText = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyText).toBeTruthy();
  }));
});
