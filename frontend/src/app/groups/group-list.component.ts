import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ApiService } from '../core/api.service';
import {
  Group,
  Person,
  PersonType,
  SkiDay,
  Registration,
  RidePreference,
  PersonPreference,
  PersonAbsence,
  PERSON_TYPE_CONFIG,
  PERSON_TYPE_OPTIONS,
} from '../core/models';

@Component({
  selector: 'app-group-list',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatChipsModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatSelectModule,
    MatDividerModule,
    MatSlideToggleModule,
    MatAutocompleteModule,
  ],
  template: `
    <h2>Groups & People</h2>

    <!-- Create Group Form -->
    <mat-card class="create-card">
      <mat-card-header
        ><mat-card-title>Add Group</mat-card-title></mat-card-header
      >
      <mat-card-content>
        <mat-form-field class="full-width">
          <mat-label>Group Name</mat-label>
          <input
            matInput
            [(ngModel)]="newGroupName"
            (keyup.enter)="createGroup()"
            placeholder="e.g. Familie Mueller"
          />
        </mat-form-field>

        <h4>Members</h4>
        @for (member of newMembers; track $index) {
          <div class="member-row">
            <mat-form-field class="member-first-name">
              <mat-label>First Name</mat-label>
              <input matInput [(ngModel)]="member.first_name" />
            </mat-form-field>
            <mat-form-field class="member-last-name">
              <mat-label>Last Name</mat-label>
              <input
                matInput
                [(ngModel)]="member.last_name"
                (keyup.enter)="
                  newMembers.push({
                    first_name: '',
                    last_name: '',
                    person_type: 'freifahrer',
                    birth_year: null,
                  })
                "
              />
            </mat-form-field>
            <mat-form-field class="type-select">
              <mat-label>Type</mat-label>
              <mat-select [(ngModel)]="member.person_type">
                @for (pt of personTypeOptions; track pt) {
                  <mat-option [value]="pt">{{
                    personTypeLabel(pt)
                  }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field class="birth-year">
              <mat-label>Birth Year</mat-label>
              <input
                matInput
                type="number"
                [(ngModel)]="member.birth_year"
                placeholder="optional"
              />
            </mat-form-field>
            <button mat-icon-button (click)="newMembers.splice($index, 1)">
              <mat-icon>remove_circle</mat-icon>
            </button>
          </div>
        }
        <button
          mat-button
          (click)="
            newMembers.push({
              first_name: '',
              last_name: '',
              person_type: 'freifahrer',
              birth_year: null,
            })
          "
        >
          <mat-icon>person_add</mat-icon> Add Member
        </button>

        <h4>Register for Days</h4>
        <div class="day-checkboxes">
          @for (day of days(); track day.id) {
            <mat-checkbox
              [checked]="selectedDays.has(day.id)"
              (change)="toggleDay(day.id)"
            >
              {{ day.name }}
            </mat-checkbox>
          }
        </div>
      </mat-card-content>
      <mat-card-actions>
        <button
          mat-raised-button
          color="primary"
          (click)="createGroup()"
          [disabled]="!newGroupName.trim() || newMembers.length === 0"
        >
          <mat-icon>add</mat-icon> Create Group
        </button>
      </mat-card-actions>
    </mat-card>

    <!-- CSV Import -->
    <mat-card class="csv-card">
      <mat-card-header
        ><mat-card-title>CSV Import</mat-card-title></mat-card-header
      >
      <mat-card-content>
        <mat-form-field class="full-width">
          <mat-label
            >Paste CSV (Name, Type, Tag columns, Busgruppe)</mat-label
          >
          <textarea
            matInput
            [(ngModel)]="csvText"
            rows="5"
            placeholder="Name,Type,Tag1,Tag2,Busgruppe&#10;Hans Mueller,Freifahrer,x,x,1&#10;Anna Mueller,Skikurs,x,,1&#10;Peter Trainer,Lehrteam,x,x,"
          ></textarea>
        </mat-form-field>
        <p class="hint-text">
          Header row required. Groups by Busgruppe column. Tag columns (x/s/k = attending) become days.
        </p>
      </mat-card-content>
      <mat-card-actions>
        <button
          mat-raised-button
          color="accent"
          (click)="importCsv()"
          [disabled]="!csvText.trim()"
        >
          <mat-icon>upload</mat-icon> Import
        </button>
      </mat-card-actions>
    </mat-card>

    <!-- Existing Groups -->
    <h3>Existing Groups ({{ groups().length }})</h3>
    <mat-accordion>
      @for (group of groups(); track group.id) {
        <mat-expansion-panel>
          <mat-expansion-panel-header>
            <mat-panel-title>
              {{ group.name }}
              <span class="member-count"
                >({{ group.members.length }} members)</span
              >
            </mat-panel-title>
            <mat-panel-description>
              @for (m of group.members; track m.id) {
                @if (personTypeIcon(m.person_type); as icon) {
                  <mat-icon
                    class="instructor-badge"
                    [fontIcon]="icon"
                  ></mat-icon>
                }
              }
            </mat-panel-description>
          </mat-expansion-panel-header>

          <div class="reg-info">
            <strong>Registered for:</strong>
            @for (dayName of getGroupDayNames(group.id); track dayName) {
              <mat-icon fontIcon="event"></mat-icon> {{ dayName }}
            } @empty {
              <em>No days registered</em>
            }
          </div>

          @if (getGroupRegisteredDays(group.id).length > 0) {
            <table class="attendance-table">
              <thead>
                <tr>
                  <th>Member</th>
                  @for (day of getGroupRegisteredDays(group.id); track day.id) {
                    <th>{{ day.name }} <span class="day-count">({{ getGroupDayAttendees(group, day.id) }})</span></th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (member of group.members; track member.id) {
                  <tr>
                    <td>
                      {{ member.last_name }}, {{ member.first_name }}
                      @if (personTypeIcon(member.person_type); as icon) {
                        <mat-icon
                          class="instructor-badge"
                          [fontIcon]="icon"
                        ></mat-icon>
                      }
                      @if (member.birth_year) {
                        <span class="birth-year">*{{ member.birth_year }}</span>
                      }
                    </td>
                    @for (
                      day of getGroupRegisteredDays(group.id);
                      track day.id
                    ) {
                      <td class="checkbox-cell">
                        <mat-checkbox
                          [checked]="!isAbsent(member.id, day.id)"
                          (change)="toggleAttendance(member.id, day.id)"
                        >
                        </mat-checkbox>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <div class="members-list">
              @for (member of group.members; track member.id) {
                <div class="member-row">
                  <span>{{ member.last_name }}, {{ member.first_name }}</span>
                  @if (personTypeIcon(member.person_type); as icon) {
                    <mat-icon class="instructor-badge" [fontIcon]="icon"></mat-icon>
                  }
                  @if (member.birth_year) {
                    <span class="birth-year">*{{ member.birth_year }}</span>
                  }
                </div>
              }
            </div>
          }

          <mat-action-row>
            <button mat-button color="warn" (click)="deleteGroup(group)">
              <mat-icon>delete</mat-icon> Delete
            </button>
          </mat-action-row>
        </mat-expansion-panel>
      }
    </mat-accordion>

    <!-- Ride Preferences -->
    <h3 style="margin-top: 2rem">Ride-Together Preferences</h3>
    <mat-card>
      <mat-card-content>
        <div class="pref-form">
          <mat-form-field>
            <mat-label>Group A</mat-label>
            <mat-select [(ngModel)]="prefGroupA">
              @for (g of groups(); track g.id) {
                <mat-option [value]="g.id">{{ g.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-icon>link</mat-icon>
          <mat-form-field>
            <mat-label>Group B</mat-label>
            <mat-select [(ngModel)]="prefGroupB">
              @for (g of groups(); track g.id) {
                <mat-option [value]="g.id">{{ g.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button
            mat-raised-button
            color="primary"
            (click)="addPreference()"
            [disabled]="!prefGroupA || !prefGroupB || prefGroupA === prefGroupB"
          >
            <mat-icon>add</mat-icon> Link
          </button>
        </div>

        @for (pref of preferences(); track pref.id) {
          <div class="pref-item">
            <span>{{ getGroupName(pref.group_a_id) }}</span>
            <mat-icon>link</mat-icon>
            <span>{{ getGroupName(pref.group_b_id) }}</span>
            <button
              mat-icon-button
              color="warn"
              (click)="deletePreference(pref.id)"
            >
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        }
      </mat-card-content>
    </mat-card>

    <!-- Person Preferences -->
    <h3 style="margin-top: 2rem">Individual Ride-Together Preferences</h3>
    <mat-card>
      <mat-card-content>
        <p class="hint-text">Link individual people across different groups.</p>
        <div class="pref-form">
          <mat-form-field>
            <mat-label>Person A</mat-label>
            <input
              matInput
              [formControl]="personAControl"
              [matAutocomplete]="autoA"
              placeholder="Type a name..."
            />
            <mat-autocomplete
              #autoA="matAutocomplete"
              [displayWith]="displayPerson.bind(this)"
              (optionSelected)="selectedPersonA = $event.option.value"
            >
              @for (p of filterPersons(personAControl.value); track p.id) {
                <mat-option [value]="p.id"
                  >{{ p.last_name }}, {{ p.first_name }}
                  <span class="group-hint"
                    >({{ getGroupNameForPerson(p) }})</span
                  ></mat-option
                >
              }
            </mat-autocomplete>
          </mat-form-field>
          <mat-icon>link</mat-icon>
          <mat-form-field>
            <mat-label>Person B</mat-label>
            <input
              matInput
              [formControl]="personBControl"
              [matAutocomplete]="autoB"
              placeholder="Type a name..."
            />
            <mat-autocomplete
              #autoB="matAutocomplete"
              [displayWith]="displayPerson.bind(this)"
              (optionSelected)="selectedPersonB = $event.option.value"
            >
              @for (p of filterPersons(personBControl.value); track p.id) {
                <mat-option [value]="p.id"
                  >{{ p.last_name }}, {{ p.first_name }}
                  <span class="group-hint"
                    >({{ getGroupNameForPerson(p) }})</span
                  ></mat-option
                >
              }
            </mat-autocomplete>
          </mat-form-field>
          <button
            mat-raised-button
            color="primary"
            (click)="addPersonPreference()"
            [disabled]="
              !selectedPersonA ||
              !selectedPersonB ||
              selectedPersonA === selectedPersonB
            "
          >
            <mat-icon>add</mat-icon> Link
          </button>
        </div>

        @for (pref of personPreferences(); track pref.id) {
          <div class="pref-item">
            <span
              >{{ pref.person_a_name }}
              <span class="group-hint">({{ pref.group_a_name }})</span></span
            >
            <mat-icon>link</mat-icon>
            <span
              >{{ pref.person_b_name }}
              <span class="group-hint">({{ pref.group_b_name }})</span></span
            >
            <button
              mat-icon-button
              color="warn"
              (click)="deletePersonPreference(pref.id)"
            >
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        }

        @if (personPreferences().length === 0) {
          <p class="hint-text" style="margin-top: 0.5rem">
            No individual preferences yet.
          </p>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [
    `
      .create-card,
      .csv-card {
        margin-bottom: 1.5rem;
      }
      .full-width {
        width: 100%;
      }
      .member-row {
        display: flex;
        gap: 1rem;
        align-items: center;
        margin-bottom: 0.5rem;
      }
      .member-first-name,
      .member-last-name {
        flex: 1;
      }
      .member-count {
        margin-left: 0.5rem;
        color: #666;
        font-weight: normal;
      }
      .instructor-badge {
        font-size: 18px;
        color: #1976d2;
        margin-left: 4px;
      }
      .day-checkboxes {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        margin: 0.5rem 0;
      }
      .pref-form {
        display: flex;
        gap: 1rem;
        align-items: center;
        margin-bottom: 1rem;
      }
      .pref-form mat-form-field {
        flex: 1;
      }
      .pref-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0;
      }
      .reg-info {
        margin: 0.5rem 0;
        display: flex;
        gap: 0.5rem;
        align-items: center;
        flex-wrap: wrap;
      }
      .members-list {
        margin-bottom: 1rem;
      }
      .group-hint {
        color: #888;
        font-size: 0.85em;
      }
      .type-select {
        width: 130px;
      }
      .birth-year {
        width: 100px;
      }
      .birth-year-text {
        color: #888;
        font-size: 0.85em;
        margin-left: 4px;
      }
      .hint-text {
        color: #888;
        font-size: 0.9em;
        margin-bottom: 1rem;
      }
      .attendance-table {
        width: 100%;
        border-collapse: collapse;
        margin: 0.5rem 0;
      }
      .attendance-table th,
      .attendance-table td {
        padding: 0.25rem 0.5rem;
        text-align: left;
      }
      .attendance-table th {
        font-weight: 500;
        font-size: 0.85em;
        opacity: 0.7;
      }
      .checkbox-cell {
        text-align: center;
      }
      .day-count {
        font-weight: normal;
        color: #888;
      }
    `,
  ],
})
export class GroupListComponent implements OnInit {
  seasonId = '';
  groups = signal<Group[]>([]);
  days = signal<SkiDay[]>([]);
  registrations = signal<Registration[]>([]);
  preferences = signal<RidePreference[]>([]);
  personPreferences = signal<PersonPreference[]>([]);
  absences = signal<PersonAbsence[]>([]);

  get allPersons(): Person[] {
    return this.groups().flatMap((g) => g.members);
  }

  newGroupName = '';
  newMembers: {
    first_name: string;
    last_name: string;
    person_type: PersonType;
    birth_year: number | null;
  }[] = [{ first_name: '', last_name: '', person_type: 'freifahrer', birth_year: null }];
  selectedDays = new Set<string>();

  csvText = '';

  prefGroupA = '';
  prefGroupB = '';

  // Person preference autocomplete
  personAControl = new FormControl('');
  personBControl = new FormControl('');
  selectedPersonA = '';
  selectedPersonB = '';

  readonly personTypeOptions = PERSON_TYPE_OPTIONS;

  personTypeLabel(type: PersonType): string {
    return PERSON_TYPE_CONFIG[type].label;
  }

  personTypeIcon(type: PersonType): string | null {
    return PERSON_TYPE_CONFIG[type].icon;
  }

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.seasonId = this.route.parent!.snapshot.params['seasonId'];
    this.loadAll();
  }

  loadAll() {
    this.api.getGroups(this.seasonId).subscribe((g) => this.groups.set(g));
    this.api.getDays(this.seasonId).subscribe((d) => this.days.set(d));
    this.api
      .getRegistrations(this.seasonId)
      .subscribe((r) => this.registrations.set(r));
    this.api
      .getRidePreferences(this.seasonId)
      .subscribe((p) => this.preferences.set(p));
    this.api
      .getPersonPreferences(this.seasonId)
      .subscribe((p) => this.personPreferences.set(p));
    this.api
      .getPersonAbsences(this.seasonId)
      .subscribe((a) => this.absences.set(a));
  }

  toggleDay(dayId: string) {
    if (this.selectedDays.has(dayId)) this.selectedDays.delete(dayId);
    else this.selectedDays.add(dayId);
  }


  createGroup() {
    const name = this.newGroupName.trim();
    const members = this.newMembers.filter((m) => m.first_name.trim() || m.last_name.trim());
    if (!name || members.length === 0) return;

    this.api
      .createGroup(this.seasonId, {
        name,
        members,
        register_for_days: [...this.selectedDays],
      })
      .subscribe(() => {
        this.newGroupName = '';
        this.newMembers = [
          { first_name: '', last_name: '', person_type: 'freifahrer', birth_year: null },
        ];
        this.selectedDays.clear();
        this.loadAll();
      });
  }

  importCsv() {
    if (!this.csvText.trim()) return;
    this.api.importCsv(this.seasonId, this.csvText).subscribe(() => {
      this.csvText = '';
      this.loadAll();
    });
  }

  deleteGroup(group: Group) {
    if (confirm(`Delete "${group.name}" and all its members?`)) {
      this.api
        .deleteGroup(this.seasonId, group.id)
        .subscribe(() => this.loadAll());
    }
  }

  getGroupDayNames(groupId: string): string[] {
    const dayIds = this.registrations()
      .filter((r) => r.group_id === groupId)
      .map((r) => r.ski_day_id);
    return this.days()
      .filter((d) => dayIds.includes(d.id))
      .map((d) => d.name);
  }

  getGroupName(groupId: string): string {
    return this.groups().find((g) => g.id === groupId)?.name || 'Unknown';
  }

  addPreference() {
    if (
      !this.prefGroupA ||
      !this.prefGroupB ||
      this.prefGroupA === this.prefGroupB
    )
      return;
    this.api
      .createRidePreference(this.seasonId, this.prefGroupA, this.prefGroupB)
      .subscribe(() => {
        this.prefGroupA = '';
        this.prefGroupB = '';
        this.loadAll();
      });
  }

  deletePreference(id: string) {
    this.api
      .deleteRidePreference(this.seasonId, id)
      .subscribe(() => this.loadAll());
  }

  // --- Person Preferences ---

  filterPersons(query: string | null): Person[] {
    const all = this.allPersons;
    if (!query || typeof query !== 'string') return all;
    const lower = query.toLowerCase();
    return all.filter(
      (p) =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(lower) ||
        this.getGroupNameForPerson(p).toLowerCase().includes(lower),
    );
  }

  displayPerson(personId: string): string {
    if (!personId) return '';
    const person = this.allPersons.find((p) => p.id === personId);
    return person ? `${person.first_name} ${person.last_name}`.trim() : '';
  }

  getGroupNameForPerson(person: Person): string {
    return this.groups().find((g) => g.id === person.group_id)?.name || '';
  }

  addPersonPreference() {
    if (
      !this.selectedPersonA ||
      !this.selectedPersonB ||
      this.selectedPersonA === this.selectedPersonB
    )
      return;
    this.api
      .createPersonPreference(
        this.seasonId,
        this.selectedPersonA,
        this.selectedPersonB,
      )
      .subscribe(() => {
        this.selectedPersonA = '';
        this.selectedPersonB = '';
        this.personAControl.reset('');
        this.personBControl.reset('');
        this.loadAll();
      });
  }

  deletePersonPreference(id: string) {
    this.api
      .deletePersonPreference(this.seasonId, id)
      .subscribe(() => this.loadAll());
  }

  // --- Person Absences ---

  getGroupRegisteredDays(groupId: string): SkiDay[] {
    const dayIds = this.registrations()
      .filter((r) => r.group_id === groupId)
      .map((r) => r.ski_day_id);
    return this.days().filter((d) => dayIds.includes(d.id));
  }

  getGroupDayAttendees(group: Group, dayId: string): number {
    return group.members.filter(m => !this.isAbsent(m.id, dayId)).length;
  }

  isAbsent(personId: string, dayId: string): boolean {
    return this.absences().some(
      (a) => a.person_id === personId && a.ski_day_id === dayId,
    );
  }

  toggleAttendance(personId: string, dayId: string) {
    const existing = this.absences().find(
      (a) => a.person_id === personId && a.ski_day_id === dayId,
    );
    if (existing) {
      this.api
        .deletePersonAbsence(this.seasonId, existing.id)
        .subscribe(() => this.loadAll());
    } else {
      this.api
        .createPersonAbsence(this.seasonId, personId, dayId)
        .subscribe(() => this.loadAll());
    }
  }
}
