import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EggLog { id: number; date: string; totalEggs: number; crackedEggs: number; feedConsumedKg: number; vitaminInWater: string; vitaminInFeed: string; notes: string; typeC: number; typeB: number; typeA: number; typeAa: number; typeAaa: number; typeJumbo: number; createdBy: string; }
export interface Sale { id: number; date: string; cartons: number; cartonType: string; pricePerCartonCop: number; customerName: string; customerPhone?: string; purchaseLocation: string; }
export interface Expense { id: number; date: string; category: string; amountCop: number; description: string; }
export interface AppUser { id: number; username: string; role: string; active: boolean; }

@Injectable({ providedIn: 'root' })
export class FarmApiService {
  constructor(private readonly http: HttpClient) {}
  eggLogs(): Observable<EggLog[]> { return this.http.get<EggLog[]>('/api/egg-logs'); }
  createEggLog(payload: Omit<EggLog, 'id' | 'createdBy'>) { return this.http.post<EggLog>('/api/egg-logs', payload); }
  stock() { return this.http.get<Record<string, number>>('/api/inventory/eggs'); }
  sales() { return this.http.get<Sale[]>('/api/sales'); }
  createSale(payload: Omit<Sale, 'id'>) { return this.http.post<Sale>('/api/sales', payload); }
  expenses() { return this.http.get<Expense[]>('/api/expenses'); }
  createExpense(payload: Omit<Expense, 'id'>) { return this.http.post<Expense>('/api/expenses', payload); }
  users() { return this.http.get<AppUser[]>('/api/users'); }
  createUser(payload: { username: string; password: string; role: string }) { return this.http.post<AppUser>('/api/users', payload); }
}
