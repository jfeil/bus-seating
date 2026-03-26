import { Routes } from '@angular/router';
import { SeasonListComponent } from './seasons/season-list.component';
import { SeasonDetailComponent } from './seasons/season-detail.component';
import { DayListComponent } from './days/day-list.component';
import { GroupListComponent } from './groups/group-list.component';
import { SeasonSettingsComponent } from './settings/season-settings.component';
import { SolverPanelComponent } from './solver/solver-panel.component';

export const routes: Routes = [
  { path: '', redirectTo: 'seasons', pathMatch: 'full' },
  { path: 'seasons', component: SeasonListComponent },
  {
    path: 'seasons/:seasonId',
    component: SeasonDetailComponent,
    children: [
      { path: '', redirectTo: 'settings', pathMatch: 'full' },
      { path: 'groups', component: GroupListComponent },
      { path: 'days', component: DayListComponent },
      { path: 'settings', component: SeasonSettingsComponent },
      { path: 'solve', component: SolverPanelComponent },
    ],
  },
];
