import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_RIPPLE_GLOBAL_OPTIONS } from '@angular/material/core';

import { routes } from './app.routes';
import { errorInterceptor } from './core/error.interceptor';

const isTauri = !!((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([errorInterceptor])),
    provideAnimationsAsync(),
    // Disable ripple animations in Tauri (WebKitGTK performance)
    ...(isTauri ? [{ provide: MAT_RIPPLE_GLOBAL_OPTIONS, useValue: { disabled: true } }] : []),
  ],
};
