import { Component, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../core/api.service';
import { SkiDay, SolveResult, SeatingPlanEntry, Group, RidePreference, Bus } from '../core/models';
import { SeatingPlanComponent } from './seating-plan.component';
import { SeatingGraphComponent } from './seating-graph.component';

@Component({
  selector: 'app-solver-panel',
  standalone: true,
  imports: [
    DecimalPipe, MatButtonModule, MatCardModule, MatIconModule, MatTabsModule,
    MatProgressSpinnerModule, MatChipsModule, SeatingPlanComponent, SeatingGraphComponent,
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
                <mat-chip color="warn" highlighted>
                  {{ result.unmet_preferences.length }} unmet preferences
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
    </mat-card>

    @if (days().length > 0 && lastResult()) {
      <!-- Graph Visualization -->
      <mat-card class="graph-card">
        <mat-card-header><mat-card-title>Bus Assignment Graph</mat-card-title></mat-card-header>
        <mat-card-content>
          <mat-tab-group (selectedIndexChange)="onGraphDayChange($event)">
            @for (day of days(); track day.id) {
              <mat-tab [label]="day.name">
                <app-seating-graph
                  [groups]="groups()"
                  [buses]="dayBuses()[day.id] || []"
                  [seatingPlan]="seatingPlans()[day.id] || []"
                  [preferences]="preferences()"
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
    .graph-card { margin-bottom: 1.5rem; }
  `],
})
export class SolverPanelComponent implements OnInit {
  seasonId = '';
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

  onGraphDayChange(index: number) {
    // Tab changed — graph will re-render with new data via inputs
  }
}
