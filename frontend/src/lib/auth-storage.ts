export interface StoredAuthState {
  accessToken: string;
  refreshToken: string;
  userName: string;
  nickName: string;
  role: string;
}

export const AUTH_STORAGE_KEY = "cuka-linux-auth";

export function readStoredAuth(): StoredAuthState | null {
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredAuthState;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function writeStoredAuth(state: StoredAuthState) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
}

export function clearStoredAuth() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
