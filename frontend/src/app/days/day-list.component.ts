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
import { SkiDay, Bus } from '../core/models';

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

  newDayName = '';
  newDayDate = '';
  newBusNames: Record<string, string> = {};
  newBusCapacities: Record<string, number> = {};
  newBusReserved: Record<string, number> = {};

  constructor(private api: ApiService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.seasonId = this.route.parent!.snapshot.params['seasonId'];
    this.loadDays();
  }

  loadDays() {
    this.api.getDays(this.seasonId).subscribe(days => {
      this.days.set(days);
      days.forEach(d => this.loadBuses(d.id));
    });
  }

  loadBuses(dayId: string) {
    this.api.getBuses(this.seasonId, dayId).subscribe(buses => {
      this.busesMap.update(m => ({ ...m, [dayId]: buses }));
    });
  }

  getBuses(dayId: string): Bus[] {
    return this.busesMap()[dayId] || [];
  }

  addDay() {
    const name = this.newDayName.trim() || `Day ${this.days().length + 1}`;
    this.api.createDay(this.seasonId, name, this.newDayDate || undefined).subscribe(() => {
      this.newDayName = '';
      this.newDayDate = '';
      this.loadDays();
    });
  }

  removeDay(day: SkiDay) {
    if (confirm(`Delete "${day.name}"?`)) {
      this.api.deleteDay(this.seasonId, day.id).subscribe(() => this.loadDays());
    }
  }

  addBus(dayId: string) {
    const existingBuses = this.getBuses(dayId);
    const name = (this.newBusNames[dayId] || '').trim() || `Bus ${existingBuses.length + 1}`;
    const capacity = this.newBusCapacities[dayId] || 50;
    const reserved = this.newBusReserved[dayId] || 0;
    this.api.createBus(this.seasonId, dayId, { name, capacity, reserved_seats: reserved }).subscribe(() => {
      this.newBusNames[dayId] = '';
      this.newBusCapacities[dayId] = 0;
      this.newBusReserved[dayId] = 0;
      this.loadBuses(dayId);
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
}
