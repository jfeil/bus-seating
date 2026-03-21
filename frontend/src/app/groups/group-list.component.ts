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
import { Group, Person, SkiDay, Registration, RidePreference, PersonPreference } from '../core/models';

@Component({
  selector: 'app-group-list',
  standalone: true,
  imports: [
    FormsModule, ReactiveFormsModule, MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule,
    MatIconModule, MatChipsModule, MatCheckboxModule, MatExpansionModule, MatSelectModule,
    MatDividerModule, MatSlideToggleModule, MatAutocompleteModule,
  ],
  template: `
    <h2>Groups & People</h2>

    <!-- Create Group Form -->
    <mat-card class="create-card">
      <mat-card-header><mat-card-title>Add Group</mat-card-title></mat-card-header>
      <mat-card-content>
        <mat-form-field class="full-width">
          <mat-label>Group Name</mat-label>
          <input matInput [(ngModel)]="newGroupName" (keyup.enter)="createGroup()" placeholder="e.g. Familie Mueller">
        </mat-form-field>

        <h4>Members</h4>
        @for (member of newMembers; track $index) {
          <div class="member-row">
            <mat-form-field class="member-name">
              <mat-label>Name</mat-label>
              <input matInput [(ngModel)]="member.name" (keyup.enter)="newMembers.push({name: '', is_instructor: false})">
            </mat-form-field>
            <mat-slide-toggle [(ngModel)]="member.is_instructor">Instructor</mat-slide-toggle>
            <button mat-icon-button (click)="newMembers.splice($index, 1)">
              <mat-icon>remove_circle</mat-icon>
            </button>
          </div>
        }
        <button mat-button (click)="newMembers.push({name: '', is_instructor: false})">
          <mat-icon>person_add</mat-icon> Add Member
        </button>

        <h4>Register for Days</h4>
        <div class="day-checkboxes">
          @for (day of days(); track day.id) {
            <mat-checkbox
              [checked]="selectedDays.has(day.id)"
              (change)="toggleDay(day.id)">
              {{ day.name }}
            </mat-checkbox>
          }
        </div>
      </mat-card-content>
      <mat-card-actions>
        <button mat-raised-button color="primary" (click)="createGroup()"
                [disabled]="!newGroupName.trim() || newMembers.length === 0">
          <mat-icon>add</mat-icon> Create Group
        </button>
      </mat-card-actions>
    </mat-card>

    <!-- CSV Import -->
    <mat-card class="csv-card">
      <mat-card-header><mat-card-title>CSV Import</mat-card-title></mat-card-header>
      <mat-card-content>
        <mat-form-field class="full-width">
          <mat-label>Paste CSV (GroupName, PersonName, IsInstructor)</mat-label>
          <textarea matInput [(ngModel)]="csvText" rows="5"
                    placeholder="Mueller Family,Hans Mueller,false&#10;Mueller Family,Anna Mueller,false&#10;Ski School,Peter Trainer,true"></textarea>
        </mat-form-field>
        <h4>Register imported groups for:</h4>
        <div class="day-checkboxes">
          @for (day of days(); track day.id) {
            <mat-checkbox
              [checked]="csvDays.has(day.id)"
              (change)="toggleCsvDay(day.id)">
              {{ day.name }}
            </mat-checkbox>
          }
        </div>
      </mat-card-content>
      <mat-card-actions>
        <button mat-raised-button color="accent" (click)="importCsv()" [disabled]="!csvText.trim()">
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
              <span class="member-count">({{ group.members.length }} members)</span>
            </mat-panel-title>
            <mat-panel-description>
              @for (m of group.members; track m.id) {
                @if (m.is_instructor) {
                  <mat-icon class="instructor-badge" fontIcon="school"></mat-icon>
                }
              }
            </mat-panel-description>
          </mat-expansion-panel-header>

          <div class="members-list">
            @for (member of group.members; track member.id) {
              <div class="member-row">
                <span>{{ member.name }}</span>
                @if (member.is_instructor) {
                  <mat-icon class="instructor-badge">school</mat-icon>
                }
              </div>
            }
          </div>

          <div class="reg-info">
            <strong>Registered for:</strong>
            @for (dayName of getGroupDayNames(group.id); track dayName) {
              <mat-icon fontIcon="event"></mat-icon> {{ dayName }}
            } @empty {
              <em>No days registered</em>
            }
          </div>

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
          <button mat-raised-button color="primary" (click)="addPreference()"
                  [disabled]="!prefGroupA || !prefGroupB || prefGroupA === prefGroupB">
            <mat-icon>add</mat-icon> Link
          </button>
        </div>

        @for (pref of preferences(); track pref.id) {
          <div class="pref-item">
            <span>{{ getGroupName(pref.group_a_id) }}</span>
            <mat-icon>link</mat-icon>
            <span>{{ getGroupName(pref.group_b_id) }}</span>
            <button mat-icon-button color="warn" (click)="deletePreference(pref.id)">
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
            <input matInput [formControl]="personAControl" [matAutocomplete]="autoA"
                   placeholder="Type a name...">
            <mat-autocomplete #autoA="matAutocomplete" [displayWith]="displayPerson.bind(this)"
                              (optionSelected)="selectedPersonA = $event.option.value">
              @for (p of filterPersons(personAControl.value); track p.id) {
                <mat-option [value]="p.id">{{ p.name }} <span class="group-hint">({{ getGroupNameForPerson(p) }})</span></mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>
          <mat-icon>link</mat-icon>
          <mat-form-field>
            <mat-label>Person B</mat-label>
            <input matInput [formControl]="personBControl" [matAutocomplete]="autoB"
                   placeholder="Type a name...">
            <mat-autocomplete #autoB="matAutocomplete" [displayWith]="displayPerson.bind(this)"
                              (optionSelected)="selectedPersonB = $event.option.value">
              @for (p of filterPersons(personBControl.value); track p.id) {
                <mat-option [value]="p.id">{{ p.name }} <span class="group-hint">({{ getGroupNameForPerson(p) }})</span></mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>
          <button mat-raised-button color="primary" (click)="addPersonPreference()"
                  [disabled]="!selectedPersonA || !selectedPersonB || selectedPersonA === selectedPersonB">
            <mat-icon>add</mat-icon> Link
          </button>
        </div>

        @for (pref of personPreferences(); track pref.id) {
          <div class="pref-item">
            <span>{{ pref.person_a_name }} <span class="group-hint">({{ pref.group_a_name }})</span></span>
            <mat-icon>link</mat-icon>
            <span>{{ pref.person_b_name }} <span class="group-hint">({{ pref.group_b_name }})</span></span>
            <button mat-icon-button color="warn" (click)="deletePersonPreference(pref.id)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        }

        @if (personPreferences().length === 0) {
          <p class="hint-text" style="margin-top: 0.5rem">No individual preferences yet.</p>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .create-card, .csv-card { margin-bottom: 1.5rem; }
    .full-width { width: 100%; }
    .member-row { display: flex; gap: 1rem; align-items: center; margin-bottom: 0.5rem; }
    .member-name { flex: 1; }
    .member-count { margin-left: 0.5rem; color: #666; font-weight: normal; }
    .instructor-badge { font-size: 18px; color: #1976d2; margin-left: 4px; }
    .day-checkboxes { display: flex; flex-wrap: wrap; gap: 1rem; margin: 0.5rem 0; }
    .pref-form { display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; }
    .pref-form mat-form-field { flex: 1; }
    .pref-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0; }
    .reg-info { margin: 0.5rem 0; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .members-list { margin-bottom: 1rem; }
    .group-hint { color: #888; font-size: 0.85em; }
    .hint-text { color: #888; font-size: 0.9em; margin-bottom: 1rem; }
  `],
})
export class GroupListComponent implements OnInit {
  seasonId = '';
  groups = signal<Group[]>([]);
  days = signal<SkiDay[]>([]);
  registrations = signal<Registration[]>([]);
  preferences = signal<RidePreference[]>([]);
  personPreferences = signal<PersonPreference[]>([]);

  get allPersons(): Person[] {
    return this.groups().flatMap(g => g.members);
  }

  newGroupName = '';
  newMembers: { name: string; is_instructor: boolean }[] = [{ name: '', is_instructor: false }];
  selectedDays = new Set<string>();

  csvText = '';
  csvDays = new Set<string>();

  prefGroupA = '';
  prefGroupB = '';

  // Person preference autocomplete
  personAControl = new FormControl('');
  personBControl = new FormControl('');
  selectedPersonA = '';
  selectedPersonB = '';

  constructor(private api: ApiService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.seasonId = this.route.parent!.snapshot.params['seasonId'];
    this.loadAll();
  }

  loadAll() {
    this.api.getGroups(this.seasonId).subscribe(g => this.groups.set(g));
    this.api.getDays(this.seasonId).subscribe(d => this.days.set(d));
    this.api.getRegistrations(this.seasonId).subscribe(r => this.registrations.set(r));
    this.api.getRidePreferences(this.seasonId).subscribe(p => this.preferences.set(p));
    this.api.getPersonPreferences(this.seasonId).subscribe(p => this.personPreferences.set(p));
  }

  toggleDay(dayId: string) {
    if (this.selectedDays.has(dayId)) this.selectedDays.delete(dayId);
    else this.selectedDays.add(dayId);
  }

  toggleCsvDay(dayId: string) {
    if (this.csvDays.has(dayId)) this.csvDays.delete(dayId);
    else this.csvDays.add(dayId);
  }

  createGroup() {
    const name = this.newGroupName.trim();
    const members = this.newMembers.filter(m => m.name.trim());
    if (!name || members.length === 0) return;

    this.api.createGroup(this.seasonId, {
      name,
      members,
      register_for_days: [...this.selectedDays],
    }).subscribe(() => {
      this.newGroupName = '';
      this.newMembers = [{ name: '', is_instructor: false }];
      this.selectedDays.clear();
      this.loadAll();
    });
  }

  importCsv() {
    const lines = this.csvText.trim().split('\n').filter(l => l.trim());
    const grouped: Record<string, { name: string; is_instructor: boolean }[]> = {};

    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 2) continue;
      const groupName = parts[0];
      const personName = parts[1];
      const isInstructor = parts[2]?.toLowerCase() === 'true';
      if (!grouped[groupName]) grouped[groupName] = [];
      grouped[groupName].push({ name: personName, is_instructor: isInstructor });
    }

    const dayIds = [...this.csvDays];
    let remaining = Object.keys(grouped).length;
    if (remaining === 0) return;

    for (const [groupName, members] of Object.entries(grouped)) {
      this.api.createGroup(this.seasonId, {
        name: groupName,
        members,
        register_for_days: dayIds,
      }).subscribe(() => {
        remaining--;
        if (remaining === 0) {
          this.csvText = '';
          this.csvDays.clear();
          this.loadAll();
        }
      });
    }
  }

  deleteGroup(group: Group) {
    if (confirm(`Delete "${group.name}" and all its members?`)) {
      this.api.deleteGroup(this.seasonId, group.id).subscribe(() => this.loadAll());
    }
  }

  getGroupDayNames(groupId: string): string[] {
    const dayIds = this.registrations()
      .filter(r => r.group_id === groupId)
      .map(r => r.ski_day_id);
    return this.days()
      .filter(d => dayIds.includes(d.id))
      .map(d => d.name);
  }

  getGroupName(groupId: string): string {
    return this.groups().find(g => g.id === groupId)?.name || 'Unknown';
  }

  addPreference() {
    if (!this.prefGroupA || !this.prefGroupB || this.prefGroupA === this.prefGroupB) return;
    this.api.createRidePreference(this.seasonId, this.prefGroupA, this.prefGroupB).subscribe(() => {
      this.prefGroupA = '';
      this.prefGroupB = '';
      this.loadAll();
    });
  }

  deletePreference(id: string) {
    this.api.deleteRidePreference(this.seasonId, id).subscribe(() => this.loadAll());
  }

  // --- Person Preferences ---

  filterPersons(query: string | null): Person[] {
    const all = this.allPersons();
    if (!query || typeof query !== 'string') return all;
    const lower = query.toLowerCase();
    return all.filter(p =>
      p.name.toLowerCase().includes(lower) ||
      this.getGroupNameForPerson(p).toLowerCase().includes(lower)
    );
  }

  displayPerson(personId: string): string {
    if (!personId) return '';
    const person = this.allPersons().find(p => p.id === personId);
    return person ? person.name : '';
  }

  getGroupNameForPerson(person: Person): string {
    return this.groups().find(g => g.id === person.group_id)?.name || '';
  }

  addPersonPreference() {
    if (!this.selectedPersonA || !this.selectedPersonB || this.selectedPersonA === this.selectedPersonB) return;
    this.api.createPersonPreference(this.seasonId, this.selectedPersonA, this.selectedPersonB).subscribe(() => {
      this.selectedPersonA = '';
      this.selectedPersonB = '';
      this.personAControl.reset('');
      this.personBControl.reset('');
      this.loadAll();
    });
  }

  deletePersonPreference(id: string) {
    this.api.deletePersonPreference(this.seasonId, id).subscribe(() => this.loadAll());
  }
}
