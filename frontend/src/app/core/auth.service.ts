import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { LoginResponse, Session, UserRole } from './auth.models';

const SESSION_KEY = 'brianna-eggs-session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionState = signal<Session | null>(this.restore());
  readonly session = this.sessionState.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionState() !== null);

  constructor(private readonly http: HttpClient, private readonly router: Router) {}

  login(username: string, password: string) {
    return this.http.post<LoginResponse>('/api/auth/login', { username, password }).pipe(
      tap((session) => this.persist(session)),
    );
  }

  logout() {
    localStorage.removeItem(SESSION_KEY);
    this.sessionState.set(null);
    void this.router.navigateByUrl('/login');
  }

  hasAnyRole(...roles: UserRole[]) {
    const role = this.sessionState()?.role;
    return role !== undefined && roles.includes(role);
  }

  private restore(): Session | null {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Session | null; } catch { return null; }
  }

  private persist(session: Session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.sessionState.set(session);
  }
}
