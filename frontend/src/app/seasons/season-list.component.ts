import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../core/api.service';
import { ThemeService } from '../core/theme.service';
import { Season } from '../core/models';

@Component({
  selector: 'app-season-list',
  standalone: true,
  imports: [FormsModule, MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="container">
      <div class="title-row">
        <h1>Bus Seating Planner</h1>
        <button mat-icon-button (click)="theme.toggle()" [matTooltip]="theme.isDark() ? 'Light mode' : 'Dark mode'">
          <mat-icon>{{ theme.isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>
      </div>
      <p class="subtitle">Select or create a season to get started.</p>

      <div class="create-form">
        <mat-form-field>
          <mat-label>New Season Name</mat-label>
          <input matInput [(ngModel)]="newName" (keyup.enter)="create()" placeholder="e.g. Winter 2026/27">
        </mat-form-field>
        <button mat-raised-button color="primary" (click)="create()" [disabled]="!newName.trim()">
          <mat-icon>add</mat-icon> Create
        </button>
      </div>

      <div class="season-grid">
        @for (season of seasons(); track season.id) {
          <mat-card class="season-card" (click)="open(season)">
            <mat-card-content>
              <h3>{{ season.name }}</h3>
            </mat-card-content>
            <mat-card-actions>
              <button mat-icon-button color="warn" (click)="remove(season, $event)">
                <mat-icon>delete</mat-icon>
              </button>
            </mat-card-actions>
          </mat-card>
        }
      </div>

      @if (seasons().length === 0) {
        <p class="empty-state">No seasons yet. Create one above!</p>
      }
    </div>
  `,
  styles: [`
    .container { max-width: 800px; margin: 2rem auto; padding: 0 1rem; padding-bottom: 4rem; }
    .title-row { display: flex; align-items: center; justify-content: space-between; }
    .subtitle { color: #666; margin-bottom: 2rem; }
    .create-form { display: flex; gap: 1rem; align-items: baseline; margin-bottom: 2rem; }
    .create-form mat-form-field { flex: 1; }
    .season-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
    .season-card { cursor: pointer; transition: box-shadow 0.2s; }
    .season-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .empty-state { text-align: center; color: #999; margin-top: 3rem; }
  `],
})
export class SeasonListComponent implements OnInit {
  seasons = signal<Season[]>([]);
  newName = '';

  constructor(private api: ApiService, private router: Router, public theme: ThemeService) {}

  ngOnInit() { this.load(); }

  load() {
    this.api.getSeasons().subscribe(s => this.seasons.set(s));
  }

  private submitting = false;

  create() {
    const name = this.newName.trim();
    if (!name || this.submitting) return;
    this.submitting = true;
    this.api.createSeason(name).subscribe({
      next: (season) => {
        this.newName = '';
        this.router.navigate(['/seasons', season.id, 'settings']);
      },
      complete: () => this.submitting = false,
      error: () => this.submitting = false,
    });
  }

  open(season: Season) {
    this.router.navigate(['/seasons', season.id, 'groups']);
  }

  remove(season: Season, event: Event) {
    event.stopPropagation();
    if (confirm(`Delete season "${season.name}"?`)) {
      this.api.deleteSeason(season.id).subscribe(() => this.load());
    }
  }
}
