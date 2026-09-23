import { Routes } from "@angular/router";
import { authenticatedGuard, roleGuard } from "./core/auth.guard";
import { ShellComponent } from "./layout/shell.component";
import { LoginPage } from "./features/login.page";
import { DashboardPage } from "./features/dashboard.page";
import { EggLogsPage } from "./features/egg-logs.page";
import { SalesPage } from "./features/sales.page";
import { ExpensesPage } from "./features/expenses.page";
import { UsersPage } from "./features/users.page";

export const routes: Routes = [
  { path: "login", component: LoginPage },
  { path: "", component: ShellComponent, canActivate: [authenticatedGuard], children: [
    { path: "", component: DashboardPage },
    { path: "recolecciones", component: EggLogsPage },
    { path: "ventas", component: SalesPage, canActivate: [roleGuard("ADMIN", "OWNER")] },
    { path: "gastos", component: ExpensesPage, canActivate: [roleGuard("ADMIN", "OWNER")] },
    { path: "usuarios", component: UsersPage, canActivate: [roleGuard("OWNER")] },
  ]},
  { path: "**", redirectTo: "" },
];
