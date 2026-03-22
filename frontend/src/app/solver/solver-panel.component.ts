import { Component, OnInit, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../core/api.service';
import { SkiDay, SolveResult, SeatingPlanEntry, Group, RidePreference, Bus, UnmetPreference } from '../core/models';
import { SeatingPlanComponent } from './seating-plan.component';
import { SeatingGraphComponent } from './seating-graph.component';

@Component({
  selector: 'app-solver-panel',
  standalone: true,
  imports: [
    DecimalPipe, MatButtonModule, MatCardModule, MatIconModule, MatTabsModule,
    MatProgressSpinnerModule, MatChipsModule, MatListModule, MatTooltipModule,
    SeatingPlanComponent, SeatingGraphComponent,
  ],
  template: `
    <h2>Solve & Results</h2>

    <mat-card class="solve-card">
      <mat-card-content class="solve-actions">
        <button mat-raised-button color="primary" (click)="runSolver()" [disabled]="solving()">
          @if (solving()) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else {
            <mat-icon>auto_fix_high</mat-icon>
          }
          Run Solver
        </button>
        <button mat-button color="warn" (click)="clearAll()" [disabled]="!lastResult()">
          <mat-icon>clear_all</mat-icon> Clear Assignments
        </button>
        <button mat-raised-button (click)="exportPdf()" [disabled]="!lastResult()">
          <mat-icon>picture_as_pdf</mat-icon> Export PDF
        </button>

        @if (lastResult(); as result) {
          <div class="result-summary">
            <span class="score">Score: {{ result.score | number:'1.1-1' }}</span>
            @if (result.unmet_preferences.length > 0) {
              <mat-chip-set>
                <mat-chip color="warn" highlighted (click)="showUnmet = !showUnmet" class="clickable-chip">
                  {{ result.unmet_preferences.length }} unmet preferences
                  <mat-icon>{{ showUnmet ? 'expand_less' : 'expand_more' }}</mat-icon>
                </mat-chip>
              </mat-chip-set>
            } @else {
              <mat-chip-set>
                <mat-chip color="primary" highlighted>All preferences met</mat-chip>
              </mat-chip-set>
            }
          </div>
        }
      </mat-card-content>

      @if (showUnmet && lastResult(); as result) {
        <mat-card-content class="unmet-list">
          <mat-list>
            @for (pref of result.unmet_preferences; track pref.preference_id) {
              <mat-list-item class="unmet-item">
                <mat-icon matListItemIcon>{{ pref.type === 'ride' ? 'directions_bus' : 'person' }}</mat-icon>
                <span matListItemTitle>
                  {{ pref.group_a_name }} &harr; {{ pref.group_b_name }}
                </span>
                @if (pref.details) {
                  <span matListItemLine class="pref-details">{{ pref.details }}</span>
                }
                <span matListItemMeta class="pref-actions">
                  <button mat-icon-button (click)="changeWeight(pref, -1)" [disabled]="pref.weight <= 1" matTooltip="Decrease weight">
                    <mat-icon>remove</mat-icon>
                  </button>
                  <span class="weight-label" [matTooltip]="'Current weight: ' + pref.weight">
                    {{ pref.weight }}x
                  </span>
                  <button mat-icon-button (click)="changeWeight(pref, 1)" matTooltip="Increase weight">
                    <mat-icon>add</mat-icon>
                  </button>
                </span>
              </mat-list-item>
            }
          </mat-list>
          <p class="unmet-hint">Adjust weights and re-run the solver to apply changes.</p>
        </mat-card-content>
      }
    </mat-card>

    @if (days().length > 0 && lastResult()) {
      <!-- Graph Visualization -->
      <mat-card class="graph-card">
        <mat-card-header>
          <mat-card-title>Bus Assignment Graph</mat-card-title>
          <button mat-icon-button (click)="graphExpanded = !graphExpanded" class="expand-btn">
            <mat-icon>{{ graphExpanded ? 'fullscreen_exit' : 'fullscreen' }}</mat-icon>
          </button>
        </mat-card-header>
        <mat-card-content>
          <mat-tab-group (selectedIndexChange)="onGraphDayChange($event)">
            @for (day of days(); track day.id) {
              <mat-tab [label]="day.name">
                <app-seating-graph
                  [groups]="dayGroups()[day.id] || []"
                  [buses]="dayBuses()[day.id] || []"
                  [seatingPlan]="seatingPlans()[day.id] || []"
                  [preferences]="preferences()"
                  [expanded]="graphExpanded"
                />
              </mat-tab>
            }
          </mat-tab-group>
        </mat-card-content>
      </mat-card>

      <!-- Seating Plans -->
      <mat-card>
        <mat-card-header><mat-card-title>Seating Plans</mat-card-title></mat-card-header>
        <mat-card-content>
          <mat-tab-group>
            @for (day of days(); track day.id) {
              <mat-tab [label]="day.name">
                <app-seating-plan
                  [plan]="seatingPlans()[day.id] || []"
                  [seasonId]="seasonId"
                  [dayId]="day.id"
                  (assignmentChanged)="loadSeatingPlan(day.id)"
                />
              </mat-tab>
            }
          </mat-tab-group>
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: [`
    .solve-card { margin-bottom: 1.5rem; }
    .solve-actions { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .result-summary { display: flex; align-items: center; gap: 1rem; }
    .score { font-weight: 500; font-size: 1.1em; }
    .clickable-chip { cursor: pointer; }
    .unmet-list { padding-top: 0; }
    .unmet-item { border-bottom: 1px solid var(--border-color); }
    .pref-details { font-size: 0.85em; }
    .pref-actions { display: flex; align-items: center; gap: 0.25rem; }
    .weight-label { font-size: 0.85em; font-weight: 500; min-width: 2em; text-align: center; }
    .unmet-hint { font-size: 0.85em; padding: 0 1rem 0.5rem; margin: 0; }
    .graph-card { margin-bottom: 1.5rem; }
    .graph-card mat-card-header { display: flex; align-items: center; }
    .expand-btn { margin-left: auto; }
  `],
})
export class SolverPanelComponent implements OnInit {
  seasonId = '';
  graphExpanded = false;
  showUnmet = false;
  days = signal<SkiDay[]>([]);
  groups = signal<Group[]>([]);
  preferences = signal<RidePreference[]>([]);
  dayBuses = signal<Record<string, Bus[]>>({});
  seatingPlans = signal<Record<string, SeatingPlanEntry[]>>({});
  lastResult = signal<SolveResult | null>(null);
  solving = signal(false);

  constructor(private api: ApiService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.seasonId = this.route.parent!.snapshot.params['seasonId'];
    this.loadData();
  }

  loadData() {
    this.api.getDays(this.seasonId).subscribe(days => {
      this.days.set(days);
      days.forEach(d => {
        this.loadSeatingPlan(d.id);
        this.api.getBuses(this.seasonId, d.id).subscribe(buses => {
          this.dayBuses.update(m => ({ ...m, [d.id]: buses }));
        });
      });
    });
    this.api.getGroups(this.seasonId).subscribe(g => this.groups.set(g));
    this.api.getRidePreferences(this.seasonId).subscribe(p => this.preferences.set(p));
  }

  loadSeatingPlan(dayId: string) {
    this.api.getSeatingPlan(this.seasonId, dayId).subscribe(plan => {
      this.seatingPlans.update(m => ({ ...m, [dayId]: plan }));
    });
  }

  runSolver() {
    this.solving.set(true);
    this.api.solve(this.seasonId).subscribe({
      next: result => {
        this.lastResult.set(result);
        this.solving.set(false);
        this.days().forEach(d => this.loadSeatingPlan(d.id));
      },
      error: () => this.solving.set(false),
    });
  }

  clearAll() {
    if (confirm('Clear all bus assignments?')) {
      this.api.clearAssignments(this.seasonId).subscribe(() => {
        this.lastResult.set(null);
        this.seatingPlans.set({});
      });
    }
  }

  exportPdf() {
    this.api.exportPdf(this.seasonId).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'seating-plan.pdf';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  changeWeight(pref: UnmetPreference, delta: number) {
    const newWeight = Math.max(1, pref.weight + delta);
    if (newWeight === pref.weight) return;
    const done = () => { pref.weight = newWeight; };
    if (pref.type === 'ride') {
      this.api.updateRidePreferenceWeight(this.seasonId, pref.preference_id, newWeight).subscribe(done);
    } else {
      this.api.updatePersonPreferenceWeight(this.seasonId, pref.preference_id, newWeight).subscribe(done);
    }
  }

  dayGroups = computed(() => {
    const plans = this.seatingPlans();
    const groups = this.groups();
    const result: Record<string, Group[]> = {};
    for (const dayId of Object.keys(plans)) {
      const assignedIds = new Set(plans[dayId].flatMap(bus => bus.groups.map(g => g.group_id)));
      result[dayId] = groups.filter(g => assignedIds.has(g.id));
    }
    return result;
  });

  onGraphDayChange(index: number) {
    // Tab changed — graph will re-render with new data via inputs
  }
}
