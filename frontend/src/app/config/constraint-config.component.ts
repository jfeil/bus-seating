import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatSliderModule } from '@angular/material/slider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../core/api.service';
import { ConstraintConfig } from '../core/models';
import { Subject, debounceTime } from 'rxjs';

interface WeightSlider {
  key: keyof ConstraintConfig;
  label: string;
  tooltip: string;
  default: number;
}

@Component({
  selector: 'app-constraint-config',
  standalone: true,
  imports: [FormsModule, MatCardModule, MatSliderModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <h2>Solver Configuration</h2>
    <p>Adjust constraint weights to control solver priorities. Higher values = stronger priority.</p>

    <mat-card>
      <mat-card-content>
        @for (slider of sliders; track slider.key) {
          <div class="weight-row">
            <div class="weight-header">
              <span class="weight-label">{{ slider.label }}</span>
              <mat-icon [matTooltip]="slider.tooltip" matTooltipPosition="right">info</mat-icon>
            </div>
            <div class="weight-controls">
              <mat-slider min="0" max="200" step="1" class="weight-slider">
                <input matSliderThumb
                       [value]="config()[slider.key]"
                       (valueChange)="onSliderChange(slider.key, $event)">
              </mat-slider>
              <mat-form-field class="weight-input">
                <input matInput type="number" min="0"
                       [value]="config()[slider.key]"
                       (change)="onInputChange(slider.key, $event)">
              </mat-form-field>
            </div>
          </div>
        }
      </mat-card-content>
      <mat-card-actions>
        <button mat-button (click)="resetDefaults()">
          <mat-icon>restore</mat-icon> Reset to Defaults
        </button>
        @if (saved()) {
          <span class="saved-indicator">Saved</span>
        }
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    .weight-row { margin-bottom: 1.5rem; }
    .weight-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
    .weight-label { font-weight: 500; }
    .weight-controls { display: flex; align-items: center; gap: 1rem; }
    .weight-slider { flex: 1; }
    .weight-input { width: 80px; }
    .saved-indicator {
      color: #4caf50; font-weight: 500; margin-left: 1rem;
      animation: fadeIn 0.3s ease-in;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  `],
})
export class ConstraintConfigComponent implements OnInit {
  seasonId = '';
  config = signal<ConstraintConfig>({
    instructor_consistency: 100,
    passenger_consistency: 50,
    ride_together: 10,
    instructor_distribution: 75,
  });
  saved = signal(false);

  private saveSubject = new Subject<Partial<ConstraintConfig>>();

  sliders: WeightSlider[] = [
    {
      key: 'instructor_consistency',
      label: 'Instructor Consistency',
      tooltip: 'How strongly instructors should stay on the same bus across different ski days',
      default: 100,
    },
    {
      key: 'passenger_consistency',
      label: 'Passenger Consistency',
      tooltip: 'How strongly families/groups should stay on the same bus across different ski days',
      default: 50,
    },
    {
      key: 'ride_together',
      label: 'Ride Together',
      tooltip: 'How strongly ride-together preferences between groups should be honored',
      default: 10,
    },
    {
      key: 'instructor_distribution',
      label: 'Instructor Distribution',
      tooltip: 'How evenly instructors should be spread across buses on each day',
      default: 75,
    },
  ];

  constructor(private api: ApiService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.seasonId = this.route.parent!.snapshot.params['seasonId'];
    this.api.getConfig(this.seasonId).subscribe(c => this.config.set(c));

    this.saveSubject.pipe(debounceTime(500)).subscribe(data => {
      this.api.updateConfig(this.seasonId, data).subscribe(c => {
        this.config.set(c);
        this.showSaved();
      });
    });
  }

  onSliderChange(key: keyof ConstraintConfig, value: number) {
    this.config.update(c => ({ ...c, [key]: value }));
    this.saveSubject.next({ [key]: value });
  }

  onInputChange(key: keyof ConstraintConfig, event: Event) {
    const value = parseFloat((event.target as HTMLInputElement).value) || 0;
    this.config.update(c => ({ ...c, [key]: value }));
    this.saveSubject.next({ [key]: value });
  }

  resetDefaults() {
    const defaults: ConstraintConfig = {
      instructor_consistency: 100,
      passenger_consistency: 50,
      ride_together: 10,
      instructor_distribution: 75,
    };
    this.config.set(defaults);
    this.api.updateConfig(this.seasonId, defaults).subscribe(c => {
      this.config.set(c);
      this.showSaved();
    });
  }

  private showSaved() {
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
