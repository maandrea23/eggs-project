export type UserRole = 'OPERATOR' | 'ADMIN' | 'OWNER';

export interface Session {
  accessToken: string;
  username: string;
  role: UserRole;
}

export interface LoginResponse extends Session {}
