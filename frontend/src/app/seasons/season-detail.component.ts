import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-season-detail',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatSidenavModule, MatListModule, MatIconModule, MatToolbarModule, MatButtonModule, MatTooltipModule],
  template: `
    <div class="wrapper">
      <mat-toolbar color="primary">
        <button mat-icon-button routerLink="/seasons">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <span>Bus Seating Planner</span>
        <span class="toolbar-spacer"></span>
        <button mat-icon-button (click)="theme.toggle()" [matTooltip]="theme.isDark() ? 'Light mode' : 'Dark mode'">
          <mat-icon>{{ theme.isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>
      </mat-toolbar>

      <mat-sidenav-container class="layout">
        <mat-sidenav mode="side" opened class="sidenav">
          <mat-nav-list>
            <a mat-list-item routerLink="groups" routerLinkActive="active-link">
              <mat-icon matListItemIcon>groups</mat-icon>
              <span matListItemTitle>Groups & People</span>
            </a>
            <a mat-list-item routerLink="days" routerLinkActive="active-link">
              <mat-icon matListItemIcon>calendar_today</mat-icon>
              <span matListItemTitle>Days & Buses</span>
            </a>
            <a mat-list-item routerLink="config" routerLinkActive="active-link">
              <mat-icon matListItemIcon>tune</mat-icon>
              <span matListItemTitle>Solver Config</span>
            </a>
            <a mat-list-item routerLink="solve" routerLinkActive="active-link">
              <mat-icon matListItemIcon>auto_fix_high</mat-icon>
              <span matListItemTitle>Solve & Results</span>
            </a>
          </mat-nav-list>
        </mat-sidenav>

        <mat-sidenav-content class="content">
          <router-outlet />
        </mat-sidenav-content>
      </mat-sidenav-container>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .wrapper { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
    .layout { flex: 1; min-height: 0; overflow: hidden; }
    .sidenav { width: 220px; }
    .content { padding: 1.5rem; padding-bottom: 4rem; overflow-y: auto; }
    .active-link { background: rgba(0,0,0,0.05); }
    .toolbar-spacer { flex: 1; }
  `],
})
export class SeasonDetailComponent {
  constructor(public theme: ThemeService) {}
}
