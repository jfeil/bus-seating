import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Season, SkiDay, Bus, Group, Registration, RidePreference, PersonPreference,
  ConstraintConfig, Assignment, SolveResult, SeatingPlanEntry,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = '/api';

  constructor(private http: HttpClient) {}

  // --- Seasons ---
  getSeasons(): Observable<Season[]> {
    return this.http.get<Season[]>(`${this.base}/seasons`);
  }
  createSeason(name: string): Observable<Season> {
    return this.http.post<Season>(`${this.base}/seasons`, { name });
  }
  deleteSeason(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/seasons/${id}`);
  }

  // --- Days ---
  getDays(seasonId: string): Observable<SkiDay[]> {
    return this.http.get<SkiDay[]>(`${this.base}/seasons/${seasonId}/days`);
  }
  createDay(seasonId: string, name: string, date?: string): Observable<SkiDay> {
    return this.http.post<SkiDay>(`${this.base}/seasons/${seasonId}/days`, { name, date });
  }
  updateDay(seasonId: string, dayId: string, data: Partial<SkiDay>): Observable<SkiDay> {
    return this.http.put<SkiDay>(`${this.base}/seasons/${seasonId}/days/${dayId}`, data);
  }
  deleteDay(seasonId: string, dayId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/seasons/${seasonId}/days/${dayId}`);
  }

  // --- Buses ---
  getBuses(seasonId: string, dayId: string): Observable<Bus[]> {
    return this.http.get<Bus[]>(`${this.base}/seasons/${seasonId}/days/${dayId}/buses`);
  }
  createBus(seasonId: string, dayId: string, data: { name: string; capacity: number; reserved_seats?: number }): Observable<Bus> {
    return this.http.post<Bus>(`${this.base}/seasons/${seasonId}/days/${dayId}/buses`, data);
  }
  updateBus(seasonId: string, dayId: string, busId: string, data: Partial<Bus>): Observable<Bus> {
    return this.http.put<Bus>(`${this.base}/seasons/${seasonId}/days/${dayId}/buses/${busId}`, data);
  }
  deleteBus(seasonId: string, dayId: string, busId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/seasons/${seasonId}/days/${dayId}/buses/${busId}`);
  }

  // --- Groups ---
  getGroups(seasonId: string): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.base}/seasons/${seasonId}/groups`);
  }
  createGroup(seasonId: string, data: { name: string; members: { name: string; is_instructor?: boolean }[]; register_for_days?: string[] }): Observable<Group> {
    return this.http.post<Group>(`${this.base}/seasons/${seasonId}/groups`, data);
  }
  updateGroup(seasonId: string, groupId: string, data: { name?: string }): Observable<Group> {
    return this.http.put<Group>(`${this.base}/seasons/${seasonId}/groups/${groupId}`, data);
  }
  deleteGroup(seasonId: string, groupId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/seasons/${seasonId}/groups/${groupId}`);
  }
  updatePerson(seasonId: string, groupId: string, personId: string, data: { name?: string; is_instructor?: boolean }): Observable<any> {
    return this.http.put(`${this.base}/seasons/${seasonId}/groups/${groupId}/members/${personId}`, data);
  }

  // --- Registrations ---
  getRegistrations(seasonId: string): Observable<Registration[]> {
    return this.http.get<Registration[]>(`${this.base}/seasons/${seasonId}/registrations`);
  }
  createRegistration(seasonId: string, groupId: string, dayId: string): Observable<Registration> {
    return this.http.post<Registration>(`${this.base}/seasons/${seasonId}/registrations?group_id=${groupId}&day_id=${dayId}`, {});
  }
  deleteRegistration(seasonId: string, registrationId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/seasons/${seasonId}/registrations/${registrationId}`);
  }

  // --- Ride Preferences ---
  getRidePreferences(seasonId: string): Observable<RidePreference[]> {
    return this.http.get<RidePreference[]>(`${this.base}/seasons/${seasonId}/ride-preferences`);
  }
  createRidePreference(seasonId: string, groupAId: string, groupBId: string): Observable<RidePreference> {
    return this.http.post<RidePreference>(`${this.base}/seasons/${seasonId}/ride-preferences`, {
      group_a_id: groupAId, group_b_id: groupBId,
    });
  }
  deleteRidePreference(seasonId: string, prefId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/seasons/${seasonId}/ride-preferences/${prefId}`);
  }

  // --- Person Preferences ---
  getPersonPreferences(seasonId: string): Observable<PersonPreference[]> {
    return this.http.get<PersonPreference[]>(`${this.base}/seasons/${seasonId}/person-preferences`);
  }
  createPersonPreference(seasonId: string, personAId: string, personBId: string): Observable<PersonPreference> {
    return this.http.post<PersonPreference>(`${this.base}/seasons/${seasonId}/person-preferences`, {
      person_a_id: personAId, person_b_id: personBId,
    });
  }
  deletePersonPreference(seasonId: string, prefId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/seasons/${seasonId}/person-preferences/${prefId}`);
  }

  // --- Config ---
  getConfig(seasonId: string): Observable<ConstraintConfig> {
    return this.http.get<ConstraintConfig>(`${this.base}/seasons/${seasonId}/config`);
  }
  updateConfig(seasonId: string, data: Partial<ConstraintConfig>): Observable<ConstraintConfig> {
    return this.http.put<ConstraintConfig>(`${this.base}/seasons/${seasonId}/config`, data);
  }

  // --- Solver ---
  solve(seasonId: string): Observable<SolveResult> {
    return this.http.post<SolveResult>(`${this.base}/seasons/${seasonId}/solve`, {});
  }
  getAssignments(seasonId: string): Observable<Assignment[]> {
    return this.http.get<Assignment[]>(`${this.base}/seasons/${seasonId}/assignments`);
  }
  overrideAssignment(seasonId: string, assignmentId: string, busId: string): Observable<Assignment> {
    return this.http.put<Assignment>(`${this.base}/seasons/${seasonId}/assignments/${assignmentId}`, { bus_id: busId });
  }
  clearAssignments(seasonId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/seasons/${seasonId}/assignments`);
  }
  getSeatingPlan(seasonId: string, dayId: string): Observable<SeatingPlanEntry[]> {
    return this.http.get<SeatingPlanEntry[]>(`${this.base}/seasons/${seasonId}/days/${dayId}/seating-plan`);
  }

  exportPdf(seasonId: string): Observable<Blob> {
    return this.http.get(`${this.base}/seasons/${seasonId}/export/pdf`, { responseType: 'blob' });
  }
}
