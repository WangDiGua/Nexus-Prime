export interface User {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'BANNED';
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface UserSettings {
  id: string;
  userId: string;
  defaultModel: string;
  systemPrompt: string | null;
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  language: string;
  maxTokens: number;
  temperature: number;
  enableHistoryContext: boolean;
  historyContextLimit: number;
  enableVectorSearch: boolean;
}

export interface UserWithSettings extends User {
  settings: UserSettings | null;
}

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  success: boolean;
  user: UserWithSettings | null;
  tokens?: AuthTokens;
  error?: string;
}
