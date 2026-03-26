import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { SeatingPlanEntry, SeatingPlanGroup, PersonType } from '../core/models';
import { ApiService } from '../core/api.service';
import { SeasonConfigService } from '../core/season-config.service';

@Component({
  selector: 'app-seating-plan',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatChipsModule, MatProgressBarModule, MatSelectModule, MatFormFieldModule],
  template: `
    <div class="bus-grid">
      @for (bus of plan; track bus.bus_id) {
        <mat-card class="bus-card">
          <mat-card-header>
            <mat-card-title>{{ bus.bus_name }}</mat-card-title>
            <mat-card-subtitle>{{ occupancy(bus) }} / {{ bus.capacity - bus.reserved_seats }} seats</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <mat-progress-bar
              [mode]="'determinate'"
              [value]="fillPercent(bus)"
              [color]="fillPercent(bus) > 90 ? 'warn' : 'primary'"
            ></mat-progress-bar>

            <div class="group-list">
              @for (group of sortedGroups(bus.groups); track group.group_id) {
                <div class="group-item" [class.instructor-group]="group.is_instructor_group">
                  <div class="group-header">
                    @if (group.is_instructor_group) {
                      <mat-icon class="instructor-icon">school</mat-icon>
                    }
                    <strong>{{ group.group_name }}</strong>
                    <span class="member-count">({{ group.members.length }})</span>
                  </div>
                  <div class="members">
                    @for (m of group.members; track m.person_id) {
                      <span class="member">
                        {{ m.person_last_name }}, {{ m.person_first_name }}
                        @if (personTypeIcon(m.person_type); as icon) { <mat-icon class="small-icon" [fontIcon]="icon"></mat-icon> }
                      </span>
                    }
                  </div>
                  <div class="move-action">
                    <mat-form-field class="move-select" subscriptSizing="dynamic">
                      <mat-label>Move to</mat-label>
                      <mat-select (selectionChange)="moveGroup(group, $event.value)">
                        @for (target of otherBuses(bus.bus_id); track target.bus_id) {
                          <mat-option [value]="target.bus_id">{{ target.bus_name }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </div>
                </div>
              }
            </div>

            @if (bus.groups.length === 0) {
              <p class="empty">No groups assigned</p>
            }
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .bus-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; padding: 1rem 0; }
    .bus-card { height: fit-content; }
    mat-progress-bar { margin: 0.5rem 0; }
    .group-list { margin-top: 0.5rem; }
    .group-item { margin: 0.25rem 0; }
    .group-header { display: flex; align-items: center; gap: 0.25rem; }
    .instructor-icon { font-size: 18px; }
    .member-count { font-weight: normal; }
    .members { margin-top: 0.25rem; display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .member { font-size: 0.9em; display: flex; align-items: center; gap: 2px; }
    .small-icon { font-size: 14px; width: 14px; height: 14px; }
    .empty { font-style: italic; }
    .move-action { margin-top: 0.25rem; }
    .move-select { font-size: 0.85em; width: 140px; }
  `],
})
export class SeatingPlanComponent {
  @Input() plan: SeatingPlanEntry[] = [];
  @Input() seasonId = '';
  @Input() dayId = '';
  @Output() assignmentChanged = new EventEmitter<void>();

  constructor(private api: ApiService, private seasonConfig: SeasonConfigService) {}

  personTypeIcon(type: PersonType): string | null {
    return this.seasonConfig.getIcon(type);
  }

  sortedGroups(groups: SeatingPlanGroup[]): SeatingPlanGroup[] {
    return [...groups].sort((a, b) => {
      if (a.is_instructor_group !== b.is_instructor_group) {
        return a.is_instructor_group ? -1 : 1;
      }
      return a.group_name.localeCompare(b.group_name, 'de');
    });
  }

  otherBuses(currentBusId: string): SeatingPlanEntry[] {
    return this.plan.filter(b => b.bus_id !== currentBusId);
  }

  moveGroup(group: SeatingPlanGroup, targetBusId: string) {
    this.api.overrideAssignment(this.seasonId, group.assignment_id, targetBusId).subscribe(() => {
      this.assignmentChanged.emit();
    });
  }

  occupancy(bus: SeatingPlanEntry): number {
    return bus.groups.reduce((sum, g) => sum + g.members.length, 0);
  }

  fillPercent(bus: SeatingPlanEntry): number {
    const effective = bus.capacity - bus.reserved_seats;
    if (effective <= 0) return 100;
    return Math.round((this.occupancy(bus) / effective) * 100);
  }
}
