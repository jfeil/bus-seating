import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  return next(req).pipe(
    catchError(error => {
      let message: string;
      if (error.status === 0) {
        message = 'Backend not reachable — is the server running?';
      } else if (error.error?.detail) {
        message = `Error: ${error.error.detail}`;
      } else {
        message = `Request failed (${error.status})`;
      }
      snackBar.open(message, 'Dismiss', { duration: 5000, panelClass: 'error-snackbar' });
      return throwError(() => error);
    })
  );
};
