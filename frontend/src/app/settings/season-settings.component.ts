import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { ApiService } from '../core/api.service';
import { SeasonConfigService } from '../core/season-config.service';
import { BusTemplate, ConstraintConfig } from '../core/models';
import { Subject, debounceTime } from 'rxjs';

const CONFIG_DEFAULTS: ConstraintConfig = {
  bus_name_prefix: 'Bus',
  default_bus_capacity: 50,
  default_reserved_seats: 0,
  label_freifahrer: 'Freifahrer',
  icon_freifahrer: '',
  label_skikurs: 'Skikurs',
  icon_skikurs: 'downhill_skiing',
  label_lehrteam: 'Lehrteam',
  icon_lehrteam: 'school',
  instructor_consistency: 100,
  passenger_consistency: 50,
  ride_together: 10,
  instructor_distribution: 75,
};

interface WeightSlider {
  key: keyof ConstraintConfig;
  label: string;
  tooltip: string;
  default: number;
}

@Component({
  selector: 'app-season-settings',
  standalone: true,
  imports: [
    FormsModule, MatCardModule, MatButtonModule, MatFormFieldModule,
    MatInputModule, MatIconModule, MatSliderModule, MatTooltipModule,
    MatExpansionModule, MatDividerModule,
  ],
  template: `
    <h2>Settings</h2>

    <!-- Bus/Room Templates -->
    <h3>{{ config().bus_name_prefix || 'Bus' }} / Room Templates</h3>
    <p class="hint">Templates are automatically added to each new day. Changes do not affect existing days.</p>

    <mat-card>
      <mat-card-content>
        <div class="bus-list">
          @for (tpl of templates(); track tpl.id) {
            <div class="bus-item">
              <mat-form-field class="bus-field">
                <mat-label>Name</mat-label>
                <input matInput [value]="tpl.name" (blur)="updateTemplate(tpl, 'name', $event)">
              </mat-form-field>
              <mat-form-field class="bus-field-sm">
                <mat-label>Capacity</mat-label>
                <input matInput type="number" [value]="tpl.capacity" (blur)="updateTemplate(tpl, 'capacity', $event)">
              </mat-form-field>
              <mat-form-field class="bus-field-sm">
                <mat-label>Reserved</mat-label>
                <input matInput type="number" [value]="tpl.reserved_seats" (blur)="updateTemplate(tpl, 'reserved_seats', $event)">
              </mat-form-field>
              <button mat-icon-button color="warn" (click)="removeTemplate(tpl.id)">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          }
        </div>

        <div class="bus-item">
          <mat-form-field class="bus-field">
            <mat-label>Name</mat-label>
            <input matInput [(ngModel)]="newTplName" (keyup.enter)="addTemplate()" [placeholder]="config().bus_name_prefix + ' A'">
          </mat-form-field>
          <mat-form-field class="bus-field-sm">
            <mat-label>Capacity</mat-label>
            <input matInput type="number" [(ngModel)]="newTplCapacity" (keyup.enter)="addTemplate()" placeholder="50">
          </mat-form-field>
          <mat-form-field class="bus-field-sm">
            <mat-label>Reserved</mat-label>
            <input matInput type="number" [(ngModel)]="newTplReserved" (keyup.enter)="addTemplate()" placeholder="0">
          </mat-form-field>
          <button mat-icon-button color="primary" (click)="addTemplate()">
            <mat-icon>add</mat-icon>
          </button>
        </div>
      </mat-card-content>
    </mat-card>

    <!-- Naming & Defaults -->
    <h3>Naming & Defaults</h3>

    <mat-card>
      <mat-card-content>
        <div class="defaults-row">
          <mat-form-field>
            <mat-label>Name Prefix</mat-label>
            <input matInput [value]="config().bus_name_prefix"
                   (change)="onTextConfigChange('bus_name_prefix', $event)"
                   placeholder="Bus">
            <mat-hint>Used for auto-naming, e.g. "Bus 1" or "Room 1"</mat-hint>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Default Capacity</mat-label>
            <input matInput type="number" [value]="config().default_bus_capacity"
                   (change)="onNumericConfigChange('default_bus_capacity', $event)">
          </mat-form-field>
          <mat-form-field>
            <mat-label>Default Reserved</mat-label>
            <input matInput type="number" [value]="config().default_reserved_seats"
                   (change)="onNumericConfigChange('default_reserved_seats', $event)">
          </mat-form-field>
        </div>
      </mat-card-content>
    </mat-card>

    <!-- Participant Types -->
    <h3>Participant Types</h3>
    <p class="hint">Customize labels and icons for the three participant categories.</p>

    <mat-card>
      <mat-card-content>
        @for (pt of participantTypes; track pt.key) {
          <div class="participant-row">
            <mat-form-field class="pt-label">
              <mat-label>{{ pt.title }} Label</mat-label>
              <input matInput [value]="config()[pt.labelKey]"
                     (change)="onTextConfigChange(pt.labelKey, $event)">
            </mat-form-field>
            <mat-form-field class="pt-icon">
              <mat-label>Icon</mat-label>
              <input matInput [value]="config()[pt.iconKey]"
                     (change)="onTextConfigChange(pt.iconKey, $event)"
                     placeholder="Material icon name">
            </mat-form-field>
            <mat-icon class="pt-preview" [class.pt-hidden]="!config()[pt.iconKey]">{{ config()[pt.iconKey] || 'blank' }}</mat-icon>
          </div>
        }
        <p class="hint icon-hint">
          Icons use
          <a href="https://fonts.google.com/icons" target="_blank" rel="noopener">Material Icons</a>.
          Leave empty for no icon.
        </p>
      </mat-card-content>
    </mat-card>

    <!-- Advanced: Solver Config -->
    <mat-expansion-panel class="advanced-panel">
      <mat-expansion-panel-header>
        <mat-panel-title>
          <mat-icon>tune</mat-icon>
          Advanced: Solver Configuration
        </mat-panel-title>
      </mat-expansion-panel-header>

      <p class="hint">Adjust constraint weights to control solver priorities. Higher values = stronger priority.</p>

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
                     (change)="onNumericConfigChange(slider.key, $event)">
            </mat-form-field>
          </div>
        </div>
      }

      <button mat-button (click)="resetSolverDefaults()">
        <mat-icon>restore</mat-icon> Reset Solver Defaults
      </button>
    </mat-expansion-panel>

    @if (saved()) {
      <div class="saved-toast">Saved</div>
    }
  `,
  styles: [`
    .hint { color: var(--mat-sys-on-surface-variant, #666); font-size: 0.85em; margin-top: -0.25rem; margin-bottom: 0.5rem; }
    .icon-hint { margin-top: 0.5rem; }
    .icon-hint a { color: inherit; }
    h3 { margin-top: 1.5rem; }
    mat-card { margin-bottom: 1rem; }
    .bus-list { margin-bottom: 0.5rem; }
    .bus-item { display: flex; gap: 0.5rem; align-items: baseline; }
    .bus-field { flex: 1; }
    .bus-field-sm { width: 100px; }
    .defaults-row { display: flex; gap: 1rem; }
    .defaults-row mat-form-field { flex: 1; }
    .participant-row { display: flex; gap: 1rem; align-items: baseline; margin-bottom: 0.25rem; }
    .pt-label { flex: 1; }
    .pt-icon { width: 200px; }
    .pt-preview { color: var(--mat-sys-on-surface-variant, #666); vertical-align: middle; width: 24px; min-width: 24px; }
    .pt-hidden { visibility: hidden; }
    .advanced-panel { margin-top: 1.5rem; }
    .advanced-panel mat-panel-title { display: flex; align-items: center; gap: 0.5rem; }
    .weight-row { margin-bottom: 1.5rem; }
    .weight-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
    .weight-label { font-weight: 500; }
    .weight-controls { display: flex; align-items: center; gap: 1rem; }
    .weight-slider { flex: 1; }
    .weight-input { width: 80px; }
    .saved-toast {
      position: fixed; bottom: 1.5rem; right: 1.5rem;
      background: #4caf50; color: white; padding: 0.5rem 1.25rem;
      border-radius: 4px; font-weight: 500;
      animation: fadeIn 0.3s ease-in;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  `],
})
export class SeasonSettingsComponent implements OnInit {
  seasonId = '';
  templates = signal<BusTemplate[]>([]);
  config = signal<ConstraintConfig>({ ...CONFIG_DEFAULTS });
  saved = signal(false);

  newTplName = '';
  newTplCapacity = 0;
  newTplReserved = 0;

  private saveSubject = new Subject<Partial<ConstraintConfig>>();

  participantTypes: { key: string; title: string; labelKey: keyof ConstraintConfig; iconKey: keyof ConstraintConfig }[] = [
    { key: 'freifahrer', title: 'Type 1', labelKey: 'label_freifahrer', iconKey: 'icon_freifahrer' },
    { key: 'skikurs', title: 'Type 2', labelKey: 'label_skikurs', iconKey: 'icon_skikurs' },
    { key: 'lehrteam', title: 'Type 3', labelKey: 'label_lehrteam', iconKey: 'icon_lehrteam' },
  ];

  sliders: WeightSlider[] = [
    {
      key: 'instructor_consistency', label: 'Instructor Consistency',
      tooltip: 'How strongly instructors should stay on the same bus across different days', default: 100,
    },
    {
      key: 'passenger_consistency', label: 'Passenger Consistency',
      tooltip: 'How strongly groups should stay on the same bus across different days', default: 50,
    },
    {
      key: 'ride_together', label: 'Ride Together',
      tooltip: 'How strongly ride-together preferences between groups should be honored', default: 10,
    },
    {
      key: 'instructor_distribution', label: 'Instructor Distribution',
      tooltip: 'How evenly instructors should be spread across buses on each day', default: 75,
    },
  ];

  constructor(private api: ApiService, private route: ActivatedRoute, private seasonConfig: SeasonConfigService) {}

  ngOnInit() {
    this.seasonId = this.route.parent!.snapshot.params['seasonId'];
    this.loadTemplates();
    this.api.getConfig(this.seasonId).subscribe(c => this.config.set(c));

    this.saveSubject.pipe(debounceTime(500)).subscribe(data => {
      this.api.updateConfig(this.seasonId, data).subscribe(c => {
        this.config.set(c);
        this.seasonConfig.update(c);
        this.showSaved();
      });
    });
  }

  // --- Templates ---

  loadTemplates() {
    this.api.getBusTemplates(this.seasonId).subscribe(t => this.templates.set(t));
  }

  private tplSubmitting = false;

  addTemplate() {
    if (this.tplSubmitting) return;
    this.tplSubmitting = true;
    const prefix = this.config().bus_name_prefix || 'Bus';
    const name = this.newTplName.trim() || `${prefix} ${this.templates().length + 1}`;
    const capacity = this.newTplCapacity || this.config().default_bus_capacity || 50;
    const reserved = this.newTplReserved || this.config().default_reserved_seats || 0;
    this.api.createBusTemplate(this.seasonId, { name, capacity, reserved_seats: reserved }).subscribe({
      next: () => {
        this.newTplName = '';
        this.newTplCapacity = 0;
        this.newTplReserved = 0;
        this.loadTemplates();
      },
      complete: () => this.tplSubmitting = false,
      error: () => this.tplSubmitting = false,
    });
  }

  updateTemplate(tpl: BusTemplate, field: string, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    const data: any = {};
    if (field === 'capacity' || field === 'reserved_seats') {
      data[field] = parseInt(value, 10);
    } else {
      data[field] = value;
    }
    this.api.updateBusTemplate(this.seasonId, tpl.id, data).subscribe(() => this.loadTemplates());
  }

  removeTemplate(templateId: string) {
    this.api.deleteBusTemplate(this.seasonId, templateId).subscribe(() => this.loadTemplates());
  }

  // --- Config ---

  onSliderChange(key: keyof ConstraintConfig, value: number) {
    this.config.update(c => ({ ...c, [key]: value }));
    this.saveSubject.next({ [key]: value });
  }

  onNumericConfigChange(key: keyof ConstraintConfig, event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (isNaN(value)) return;
    this.config.update(c => ({ ...c, [key]: value }));
    this.saveSubject.next({ [key]: value });
  }

  onTextConfigChange(key: keyof ConstraintConfig, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.config.update(c => ({ ...c, [key]: value }));
    this.saveSubject.next({ [key]: value });
  }

  resetSolverDefaults() {
    const defaults: Partial<ConstraintConfig> = {
      instructor_consistency: 100,
      passenger_consistency: 50,
      ride_together: 10,
      instructor_distribution: 75,
    };
    this.config.update(c => ({ ...c, ...defaults }));
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
