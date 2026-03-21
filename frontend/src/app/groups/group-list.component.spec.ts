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
  }

  it('should load groups, days, registrations, and preferences on init', fakeAsync(() => {
    const fixture = TestBed.createComponent(GroupListComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/seasons/s1/groups').flush([
      { id: 'g1', season_id: 's1', name: 'Family A', members: [{ id: 'p1', name: 'Alice', is_instructor: false, group_id: 'g1' }] },
    ]);
    httpMock.expectOne('/api/seasons/s1/days').flush([]);
    httpMock.expectOne('/api/seasons/s1/registrations').flush([]);
    httpMock.expectOne('/api/seasons/s1/ride-preferences').flush([]);
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
      { name: 'Bob', is_instructor: false },
      { name: 'Carol', is_instructor: true },
    ];
    fixture.componentInstance.selectedDays.add('d1');
    fixture.componentInstance.createGroup();

    const req = httpMock.expectOne(r => r.method === 'POST' && r.url === '/api/seasons/s1/groups');
    expect(req.request.body.name).toBe('Test Group');
    expect(req.request.body.members.length).toBe(2);
    expect(req.request.body.register_for_days).toEqual(['d1']);
    req.flush({ id: 'g2', season_id: 's1', name: 'Test Group', members: [] });
    tick();

    // Reload triggers
    httpMock.expectOne('/api/seasons/s1/groups').flush([]);
    httpMock.expectOne('/api/seasons/s1/days').flush([]);
    httpMock.expectOne('/api/seasons/s1/registrations').flush([]);
    httpMock.expectOne('/api/seasons/s1/ride-preferences').flush([]);
    tick();

    expect(fixture.componentInstance.newGroupName).toBe('');
  }));

  it('should not create group with empty name', fakeAsync(() => {
    const fixture = TestBed.createComponent(GroupListComponent);
    fixture.detectChanges();
    flushInitialLoad();
    tick();

    fixture.componentInstance.newGroupName = '';
    fixture.componentInstance.newMembers = [{ name: 'Alice', is_instructor: false }];
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

  it('should parse and import CSV', fakeAsync(() => {
    const fixture = TestBed.createComponent(GroupListComponent);
    fixture.detectChanges();
    flushInitialLoad();
    tick();

    fixture.componentInstance.csvText = [
      'Family A,Hans,false',
      'Family A,Anna,false',
      'Ski School,Peter,true',
    ].join('\n');
    fixture.componentInstance.csvDays.add('d1');
    fixture.componentInstance.importCsv();

    // Should create 2 groups: Family A (2 members) and Ski School (1 member)
    const reqs = httpMock.match(r => r.method === 'POST' && r.url === '/api/seasons/s1/groups');
    expect(reqs.length).toBe(2);

    const familyReq = reqs.find(r => r.request.body.name === 'Family A');
    expect(familyReq!.request.body.members.length).toBe(2);
    expect(familyReq!.request.body.register_for_days).toEqual(['d1']);

    const schoolReq = reqs.find(r => r.request.body.name === 'Ski School');
    expect(schoolReq!.request.body.members[0].is_instructor).toBe(true);

    // Flush creates — only the last one triggers reload
    familyReq!.flush({ id: 'g1', season_id: 's1', name: 'Family A', members: [] });
    tick();
    schoolReq!.flush({ id: 'g2', season_id: 's1', name: 'Ski School', members: [] });
    tick();

    httpMock.expectOne('/api/seasons/s1/groups').flush([]);
    httpMock.expectOne('/api/seasons/s1/days').flush([]);
    httpMock.expectOne('/api/seasons/s1/registrations').flush([]);
    httpMock.expectOne('/api/seasons/s1/ride-preferences').flush([]);
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
    tick();

    const dayNames = fixture.componentInstance.getGroupDayNames('g1');
    expect(dayNames).toEqual(['Day 1']);
  }));
});
