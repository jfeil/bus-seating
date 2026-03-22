import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { ApiService } from '../core/api.service';
import { SkiDay, Bus, Group, Registration, PersonAbsence } from '../core/models';

@Component({
  selector: 'app-day-list',
  standalone: true,
  imports: [FormsModule, MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, MatChipsModule, MatDividerModule],
  template: `
    <h2>Ski Days & Buses</h2>

    <div class="add-form">
      <mat-form-field>
        <mat-label>Day Name</mat-label>
        <input matInput [(ngModel)]="newDayName" (keyup.enter)="addDay()" placeholder="e.g. Day 1 - Arlberg">
      </mat-form-field>
      <mat-form-field>
        <mat-label>Date</mat-label>
        <input matInput type="date" [(ngModel)]="newDayDate" (keyup.enter)="addDay()">
      </mat-form-field>
      <button mat-raised-button color="primary" (click)="addDay()">
        <mat-icon>add</mat-icon> Add Day
      </button>
    </div>

    @for (day of days(); track day.id) {
      <mat-card class="day-card">
        <mat-card-header>
          <mat-card-title>{{ day.name }}</mat-card-title>
          <mat-card-subtitle>{{ day.date || 'No date set' }}</mat-card-subtitle>
          <span class="spacer"></span>
          <div class="capacity-summary">
            <mat-icon [class]="capacityClass(day.id)">{{ capacityIcon(day.id) }}</mat-icon>
            <span [class]="capacityClass(day.id)">
              {{ getAttendees(day.id) }} attendees /
              {{ getTotalCapacity(day.id) }} seats
              ({{ getAvailableSeats(day.id) >= 0 ? '+' : '' }}{{ getAvailableSeats(day.id) }} free)
            </span>
          </div>
          <button mat-icon-button color="warn" (click)="removeDay(day)">
            <mat-icon>delete</mat-icon>
          </button>
        </mat-card-header>

        <mat-card-content>
          <h4>Buses</h4>
          <div class="bus-list">
            @for (bus of getBuses(day.id); track bus.id) {
              <div class="bus-item">
                <mat-form-field class="bus-field">
                  <mat-label>Name</mat-label>
                  <input matInput [value]="bus.name" (blur)="updateBus(day.id, bus, 'name', $event)">
                </mat-form-field>
                <mat-form-field class="bus-field-sm">
                  <mat-label>Capacity</mat-label>
                  <input matInput type="number" [value]="bus.capacity" (blur)="updateBus(day.id, bus, 'capacity', $event)">
                </mat-form-field>
                <mat-form-field class="bus-field-sm">
                  <mat-label>Reserved</mat-label>
                  <input matInput type="number" [value]="bus.reserved_seats" (blur)="updateBus(day.id, bus, 'reserved_seats', $event)">
                </mat-form-field>
                <button mat-icon-button color="warn" (click)="removeBus(day.id, bus.id)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            }
          </div>

          <div class="add-bus-form">
            <mat-form-field class="bus-field">
              <mat-label>Bus Name</mat-label>
              <input matInput [(ngModel)]="newBusNames[day.id]" (keyup.enter)="addBus(day.id)" placeholder="e.g. Bus A">
            </mat-form-field>
            <mat-form-field class="bus-field-sm">
              <mat-label>Capacity</mat-label>
              <input matInput type="number" [(ngModel)]="newBusCapacities[day.id]" (keyup.enter)="addBus(day.id)" placeholder="50">
            </mat-form-field>
            <mat-form-field class="bus-field-sm">
              <mat-label>Reserved</mat-label>
              <input matInput type="number" [(ngModel)]="newBusReserved[day.id]" (keyup.enter)="addBus(day.id)" placeholder="0">
            </mat-form-field>
            <button mat-icon-button color="primary" (click)="addBus(day.id)">
              <mat-icon>add</mat-icon>
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: [`
    .add-form { display: flex; gap: 1rem; align-items: baseline; margin-bottom: 1rem; }
    .add-form mat-form-field:first-child { flex: 1; }
    .day-card { margin-bottom: 1rem; }
    mat-card-header { display: flex; align-items: center; }
    .spacer { flex: 1; }
    .capacity-summary { display: flex; align-items: center; gap: 0.25rem; font-size: 0.9em; margin-right: 0.5rem; white-space: nowrap; }
    .cap-ok { color: #4caf50; }
    .cap-tight { color: #ff9800; }
    .cap-over { color: #f44336; }
    .bus-list { margin-bottom: 0.5rem; }
    .bus-item, .add-bus-form { display: flex; gap: 0.5rem; align-items: baseline; }
    .bus-field { flex: 1; }
    .bus-field-sm { width: 100px; }
  `],
})
export class DayListComponent implements OnInit {
  seasonId = '';
  days = signal<SkiDay[]>([]);
  busesMap = signal<Record<string, Bus[]>>({});
  groups = signal<Group[]>([]);
  registrations = signal<Registration[]>([]);
  absences = signal<PersonAbsence[]>([]);

  newDayName = '';
  newDayDate = '';
  newBusNames: Record<string, string> = {};
  newBusCapacities: Record<string, number> = {};
  newBusReserved: Record<string, number> = {};

  constructor(private api: ApiService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.seasonId = this.route.parent!.snapshot.params['seasonId'];
    this.loadAll();
  }

  loadAll() {
    this.api.getDays(this.seasonId).subscribe(days => {
      this.days.set(days);
      days.forEach(d => this.loadBuses(d.id));
    });
    this.api.getGroups(this.seasonId).subscribe(g => this.groups.set(g));
    this.api.getRegistrations(this.seasonId).subscribe(r => this.registrations.set(r));
    this.api.getPersonAbsences(this.seasonId).subscribe(a => this.absences.set(a));
  }

  loadBuses(dayId: string) {
    this.api.getBuses(this.seasonId, dayId).subscribe(buses => {
      this.busesMap.update(m => ({ ...m, [dayId]: buses }));
    });
  }

  getBuses(dayId: string): Bus[] {
    return this.busesMap()[dayId] || [];
  }

  private submitting = false;

  addDay() {
    if (this.submitting) return;
    this.submitting = true;
    const name = this.newDayName.trim() || `Day ${this.days().length + 1}`;
    this.api.createDay(this.seasonId, name, this.newDayDate || undefined).subscribe({
      next: () => {
        this.newDayName = '';
        this.newDayDate = '';
        this.loadAll();
      },
      complete: () => this.submitting = false,
      error: () => this.submitting = false,
    });
  }

  removeDay(day: SkiDay) {
    if (confirm(`Delete "${day.name}"?`)) {
      this.api.deleteDay(this.seasonId, day.id).subscribe(() => this.loadAll());
    }
  }

  private busSubmitting: Record<string, boolean> = {};

  addBus(dayId: string) {
    if (this.busSubmitting[dayId]) return;
    this.busSubmitting[dayId] = true;
    const existingBuses = this.getBuses(dayId);
    const name = (this.newBusNames[dayId] || '').trim() || `Bus ${existingBuses.length + 1}`;
    const capacity = this.newBusCapacities[dayId] || 50;
    const reserved = this.newBusReserved[dayId] || 0;
    this.api.createBus(this.seasonId, dayId, { name, capacity, reserved_seats: reserved }).subscribe({
      next: () => {
        this.newBusNames[dayId] = '';
        this.newBusCapacities[dayId] = 0;
        this.newBusReserved[dayId] = 0;
        this.loadBuses(dayId);
      },
      complete: () => this.busSubmitting[dayId] = false,
      error: () => this.busSubmitting[dayId] = false,
    });
  }

  updateBus(dayId: string, bus: Bus, field: string, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    const data: any = {};
    if (field === 'capacity' || field === 'reserved_seats') {
      data[field] = parseInt(value, 10);
    } else {
      data[field] = value;
    }
    this.api.updateBus(this.seasonId, dayId, bus.id, data).subscribe(() => this.loadBuses(dayId));
  }

  removeBus(dayId: string, busId: string) {
    this.api.deleteBus(this.seasonId, dayId, busId).subscribe(() => this.loadBuses(dayId));
  }

  // --- Capacity overview ---

  getAttendees(dayId: string): number {
    const groupIds = this.registrations()
      .filter(r => r.ski_day_id === dayId)
      .map(r => r.group_id);
    const absentOnDay = new Set(
      this.absences().filter(a => a.ski_day_id === dayId).map(a => a.person_id),
    );
    return this.groups()
      .filter(g => groupIds.includes(g.id))
      .reduce((sum, g) => sum + g.members.filter(m => !absentOnDay.has(m.id)).length, 0);
  }

  getTotalCapacity(dayId: string): number {
    return this.getBuses(dayId).reduce((sum, b) => sum + b.capacity - b.reserved_seats, 0);
  }

  getAvailableSeats(dayId: string): number {
    return this.getTotalCapacity(dayId) - this.getAttendees(dayId);
  }

  capacityClass(dayId: string): string {
    const free = this.getAvailableSeats(dayId);
    const total = this.getTotalCapacity(dayId);
    if (free < 0) return 'cap-over';
    if (total > 0 && free / total < 0.1) return 'cap-tight';
    return 'cap-ok';
  }

  capacityIcon(dayId: string): string {
    const free = this.getAvailableSeats(dayId);
    const total = this.getTotalCapacity(dayId);
    if (free < 0) return 'error';
    if (total > 0 && free / total < 0.1) return 'warning';
    return 'check_circle';
  }
}
