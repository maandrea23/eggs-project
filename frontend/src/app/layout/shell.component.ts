import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterOutlet],
  template: `
    <div class="shell">
      <header><a routerLink="/" class="brand">BRIANNA EGGS</a><div class="account"><span>{{ auth.session()?.username }} · {{ auth.session()?.role }}</span><button (click)="auth.logout()">Salir</button></div></header>
      <nav><a routerLink="/">Inicio</a><a routerLink="/recolecciones">Recolecciones</a>@if (auth.hasAnyRole('ADMIN','OWNER')) { <a routerLink="/ventas">Ventas</a><a routerLink="/gastos">Gastos</a> } @if (auth.hasAnyRole('OWNER')) { <a routerLink="/usuarios">Usuarios</a> }</nav>
      <main><router-outlet /></main>
    </div>
  `,
  styles: `:host{display:block}.shell{min-height:100vh;background:#f8f5ed;color:#26382d}header{align-items:center;background:#314d3b;color:#fff;display:flex;justify-content:space-between;padding:1rem max(1.25rem,calc((100vw - 1200px)/2))}.brand{color:#fff;font-weight:800;letter-spacing:.15em;text-decoration:none}.account{align-items:center;display:flex;gap:1rem;font-size:.875rem}button{border:0;border-radius:999px;cursor:pointer;padding:.55rem .9rem}nav{display:flex;gap:.5rem;overflow:auto;padding:1rem max(1.25rem,calc((100vw - 1200px)/2));background:#e9e6d8}nav a{border-radius:999px;color:#314d3b;font-weight:700;padding:.6rem .85rem;text-decoration:none;white-space:nowrap}nav a:hover{background:#cbd9a9}main{margin:auto;max-width:1200px;padding:1.25rem}@media(max-width:640px){header{align-items:flex-start;gap:.7rem;flex-direction:column}.account{width:100%;justify-content:space-between}}`,
})
export class ShellComponent { constructor(public readonly auth: AuthService) {} }
