import { Injectable, signal } from '@angular/core';
import { ConstraintConfig, PersonType, PersonTypeInfo } from './models';

const DEFAULTS: Record<PersonType, PersonTypeInfo> = {
  freifahrer: { label: 'Freifahrer', icon: null, isInstructorLike: false },
  skikurs: { label: 'Skikurs', icon: 'downhill_skiing', isInstructorLike: false },
  lehrteam: { label: 'Lehrteam', icon: 'school', isInstructorLike: true },
};

@Injectable({ providedIn: 'root' })
export class SeasonConfigService {
  private _config = signal<ConstraintConfig | null>(null);

  get config() { return this._config; }

  update(config: ConstraintConfig) {
    this._config.set(config);
  }

  get busNamePrefix(): string {
    return this._config()?.bus_name_prefix || 'Bus';
  }

  getPersonTypeInfo(type: PersonType): PersonTypeInfo {
    const c = this._config();
    if (!c) return DEFAULTS[type];
    switch (type) {
      case 'freifahrer':
        return { label: c.label_freifahrer || 'Freifahrer', icon: c.icon_freifahrer || null, isInstructorLike: false };
      case 'skikurs':
        return { label: c.label_skikurs || 'Skikurs', icon: c.icon_skikurs || null, isInstructorLike: false };
      case 'lehrteam':
        return { label: c.label_lehrteam || 'Lehrteam', icon: c.icon_lehrteam || null, isInstructorLike: true };
    }
  }

  getLabel(type: PersonType): string {
    return this.getPersonTypeInfo(type).label;
  }

  getIcon(type: PersonType): string | null {
    return this.getPersonTypeInfo(type).icon;
  }
}
