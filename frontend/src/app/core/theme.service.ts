import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  isDark = signal(localStorage.getItem('theme') === 'dark');

  constructor() {
    this.apply();
  }

  toggle() {
    this.isDark.update(v => !v);
    localStorage.setItem('theme', this.isDark() ? 'dark' : 'light');
    this.apply();
  }

  private apply() {
    document.body.classList.toggle('dark-theme', this.isDark());
  }
}
