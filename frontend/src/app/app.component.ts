import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MatProgressSpinnerModule],
  template: `
    @if (ready()) {
      <router-outlet />
    } @else {
      <div class="loading-screen">
        <mat-spinner diameter="48"></mat-spinner>
        <p class="loading-text">Starting application…</p>
        @if (slow()) {
          <p class="loading-warning">
            This is taking longer than expected. The backend may have failed to
            start.
          </p>
        }
      </div>
    }
  `,
  styles: [
    `
      .loading-screen {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        gap: 1rem;
      }
      .loading-text {
        color: var(--text-secondary);
        font-size: 1.1rem;
      }
      .loading-warning {
        color: #d32f2f;
        font-size: 0.9rem;
        max-width: 400px;
        text-align: center;
      }
    `,
  ],
})
export class AppComponent implements OnInit {
  ready = signal(false);
  slow = signal(false);

  private isTauri = !!(
    (window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__
  );

  constructor(private http: HttpClient) {}

  ngOnInit() {
    if (!this.isTauri) {
      this.ready.set(true);
      return;
    }
    this.waitForBackend();
  }

  private waitForBackend() {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const port = (window as any).__BACKEND_PORT__;
      if (!port) {
        if (Date.now() - startTime > 10000) {
          this.slow.set(true);
        }
        return;
      }
      this.http.get(`http://127.0.0.1:${port}/api/health`).subscribe({
        next: () => {
          clearInterval(interval);
          this.ready.set(true);
        },
        error: () => {
          if (Date.now() - startTime > 10000) {
            this.slow.set(true);
          }
        },
      });
    }, 300);
  }
}
