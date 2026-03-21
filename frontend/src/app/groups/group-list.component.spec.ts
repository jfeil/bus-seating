import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { GroupListComponent } from './group-list.component';

describe('GroupListComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupListComponent, NoopAnimationsModule],
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

  function flushInitialLoad() {
    httpMock.expectOne('/api/seasons/s1/groups').flush([]);
    httpMock.expectOne('/api/seasons/s1/days').flush([
      { id: 'd1', season_id: 's1', name: 'Day 1', date: null },
    ]);
    httpMock.expectOne('/api/seasons/s1/registrations').flush([]);
    httpMock.expectOne('/api/seasons/s1/ride-preferences').flush([]);
    httpMock.expectOne('/api/seasons/s1/person-preferences').flush([]);
    httpMock.expectOne('/api/seasons/s1/person-absences').flush([]);
  }

  function flushReload() {
    httpMock.expectOne('/api/seasons/s1/groups').flush([]);
    httpMock.expectOne('/api/seasons/s1/days').flush([]);
    httpMock.expectOne('/api/seasons/s1/registrations').flush([]);
    httpMock.expectOne('/api/seasons/s1/ride-preferences').flush([]);
    httpMock.expectOne('/api/seasons/s1/person-preferences').flush([]);
    httpMock.expectOne('/api/seasons/s1/person-absences').flush([]);
  }

  it('should load groups, days, registrations, and preferences on init', fakeAsync(() => {
    const fixture = TestBed.createComponent(GroupListComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/seasons/s1/groups').flush([
      { id: 'g1', season_id: 's1', name: 'Family A', members: [{ id: 'p1', first_name: 'Alice', last_name: 'Smith', person_type: 'freifahrer', birth_year: null, group_id: 'g1' }] },
    ]);
    httpMock.expectOne('/api/seasons/s1/days').flush([]);
    httpMock.expectOne('/api/seasons/s1/registrations').flush([]);
    httpMock.expectOne('/api/seasons/s1/ride-preferences').flush([]);
    httpMock.expectOne('/api/seasons/s1/person-preferences').flush([]);
    httpMock.expectOne('/api/seasons/s1/person-absences').flush([]);
    tick();

    expect(fixture.componentInstance.groups().length).toBe(1);
  }));

  it('should create a group with members and day registrations', fakeAsync(() => {
    const fixture = TestBed.createComponent(GroupListComponent);
    fixture.detectChanges();
    flushInitialLoad();
    tick();

    fixture.componentInstance.newGroupName = 'Test Group';
    fixture.componentInstance.newMembers = [
      { first_name: 'Bob', last_name: 'Jones', person_type: 'freifahrer' as const, birth_year: null },
      { first_name: 'Carol', last_name: 'Lee', person_type: 'lehrteam' as const, birth_year: null },
    ];
    fixture.componentInstance.selectedDays.add('d1');
    fixture.componentInstance.createGroup();

    const req = httpMock.expectOne(r => r.method === 'POST' && r.url === '/api/seasons/s1/groups');
    expect(req.request.body.name).toBe('Test Group');
    expect(req.request.body.members.length).toBe(2);
    expect(req.request.body.register_for_days).toEqual(['d1']);
    req.flush({ id: 'g2', season_id: 's1', name: 'Test Group', members: [] });
    tick();

    flushReload();
    tick();

    expect(fixture.componentInstance.newGroupName).toBe('');
  }));

  it('should not create group with empty name', fakeAsync(() => {
    const fixture = TestBed.createComponent(GroupListComponent);
    fixture.detectChanges();
    flushInitialLoad();
    tick();

    fixture.componentInstance.newGroupName = '';
    fixture.componentInstance.newMembers = [{ first_name: 'Alice', last_name: 'Smith', person_type: 'freifahrer' as const, birth_year: null }];
    fixture.componentInstance.createGroup();

    httpMock.expectNone(r => r.method === 'POST');
  }));

  it('should not create group with no members', fakeAsync(() => {
    const fixture = TestBed.createComponent(GroupListComponent);
    fixture.detectChanges();
    flushInitialLoad();
    tick();

    fixture.componentInstance.newGroupName = 'Empty Group';
    fixture.componentInstance.newMembers = [];
    fixture.componentInstance.createGroup();

    httpMock.expectNone(r => r.method === 'POST');
  }));

  it('should import CSV via backend endpoint', fakeAsync(() => {
    const fixture = TestBed.createComponent(GroupListComponent);
    fixture.detectChanges();
    flushInitialLoad();
    tick();

    fixture.componentInstance.csvText = 'Name,Type,Tag1,Busgruppe\nHans,Freifahrer,x,1\nAnna,Skikurs,x,1';
    fixture.componentInstance.importCsv();

    const req = httpMock.expectOne(r => r.method === 'POST' && r.url === '/api/seasons/s1/import-csv');
    expect(req.request.body.csv_text).toContain('Hans');
    req.flush({ days_created: 1, groups_created: 1, persons_created: 2, absences_created: 0 });
    tick();

    flushReload();
    tick();

    expect(fixture.componentInstance.csvText).toBe('');
  }));

  it('should add a ride preference', fakeAsync(() => {
    const fixture = TestBed.createComponent(GroupListComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/seasons/s1/groups').flush([
      { id: 'g1', season_id: 's1', name: 'G1', members: [] },
      { id: 'g2', season_id: 's1', name: 'G2', members: [] },
    ]);
    httpMock.expectOne('/api/seasons/s1/days').flush([]);
    httpMock.expectOne('/api/seasons/s1/registrations').flush([]);
    httpMock.expectOne('/api/seasons/s1/ride-preferences').flush([]);
    httpMock.expectOne('/api/seasons/s1/person-preferences').flush([]);
    httpMock.expectOne('/api/seasons/s1/person-absences').flush([]);
    tick();

    fixture.componentInstance.prefGroupA = 'g1';
    fixture.componentInstance.prefGroupB = 'g2';
    fixture.componentInstance.addPreference();

    const req = httpMock.expectOne(r => r.method === 'POST' && r.url === '/api/seasons/s1/ride-preferences');
    expect(req.request.body).toEqual({ group_a_id: 'g1', group_b_id: 'g2' });
    req.flush({ id: 'pr1', season_id: 's1', group_a_id: 'g1', group_b_id: 'g2' });
    tick();

    httpMock.expectOne('/api/seasons/s1/groups').flush([]);
    httpMock.expectOne('/api/seasons/s1/days').flush([]);
    httpMock.expectOne('/api/seasons/s1/registrations').flush([]);
    httpMock.expectOne('/api/seasons/s1/ride-preferences').flush([
      { id: 'pr1', season_id: 's1', group_a_id: 'g1', group_b_id: 'g2' },
    ]);
    httpMock.expectOne('/api/seasons/s1/person-preferences').flush([]);
    httpMock.expectOne('/api/seasons/s1/person-absences').flush([]);
    tick();

    expect(fixture.componentInstance.preferences().length).toBe(1);
  }));

  it('should not add preference for same group', fakeAsync(() => {
    const fixture = TestBed.createComponent(GroupListComponent);
    fixture.detectChanges();
    flushInitialLoad();
    tick();

    fixture.componentInstance.prefGroupA = 'g1';
    fixture.componentInstance.prefGroupB = 'g1';
    fixture.componentInstance.addPreference();

    httpMock.expectNone(r => r.method === 'POST' && r.url.includes('ride-preferences'));
  }));

  it('should resolve group day names', fakeAsync(() => {
    const fixture = TestBed.createComponent(GroupListComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/seasons/s1/groups').flush([
      { id: 'g1', season_id: 's1', name: 'G1', members: [] },
    ]);
    httpMock.expectOne('/api/seasons/s1/days').flush([
      { id: 'd1', season_id: 's1', name: 'Day 1', date: null },
      { id: 'd2', season_id: 's1', name: 'Day 2', date: null },
    ]);
    httpMock.expectOne('/api/seasons/s1/registrations').flush([
      { id: 'r1', group_id: 'g1', ski_day_id: 'd1' },
    ]);
    httpMock.expectOne('/api/seasons/s1/ride-preferences').flush([]);
    httpMock.expectOne('/api/seasons/s1/person-preferences').flush([]);
    httpMock.expectOne('/api/seasons/s1/person-absences').flush([]);
    tick();

    const dayNames = fixture.componentInstance.getGroupDayNames('g1');
    expect(dayNames).toEqual(['Day 1']);
  }));
});
