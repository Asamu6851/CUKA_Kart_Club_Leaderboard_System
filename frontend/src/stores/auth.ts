import { defineStore } from "pinia";

import { apiFetch } from "@/lib/http";
import {
  clearStoredAuth,
  readStoredAuth,
  writeStoredAuth
} from "@/lib/auth-storage";

interface LoginPayload {
  username: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    nickname: string;
    role: string;
  };
}

interface CurrentUserResponse {
  id: string;
  username: string;
  nickname: string;
  role: string;
}

export const useAuthStore = defineStore("auth", {
  state: () => ({
    accessToken: "",
    refreshToken: "",
    userName: "",
    nickName: "",
    role: ""
  }),
  getters: {
    isAuthenticated: (state) => !!state.accessToken
  },
  actions: {
    initialize() {
      const saved = readStoredAuth();
      if (!saved) {
        return;
      }

      this.accessToken = saved.accessToken || "";
      this.refreshToken = saved.refreshToken || "";
      this.userName = saved.userName || "";
      this.nickName = saved.nickName || "";
      this.role = saved.role || "";
    },
    async login(payload: LoginPayload) {
      const result = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      this.accessToken = result.accessToken;
      this.refreshToken = result.refreshToken;
      this.userName = result.user.username;
      this.nickName = result.user.nickname;
      this.role = result.user.role;

      writeStoredAuth({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        userName: this.userName,
        nickName: this.nickName,
        role: this.role
      });
    },
    async fetchMe() {
      const result = await apiFetch<CurrentUserResponse>("/auth/me");

      this.userName = result.username;
      this.nickName = result.nickname;
      this.role = result.role;

      writeStoredAuth({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        userName: this.userName,
        nickName: this.nickName,
        role: this.role
      });

      return result;
    },
    async logout() {
      const refreshToken = this.refreshToken;

      try {
        if (refreshToken) {
          await apiFetch<{ success: boolean }>("/auth/logout", {
            method: "POST",
            body: JSON.stringify({
              refreshToken
            })
          });
        }
      } catch {
        // Ignore logout API errors and always clear local state.
      }

      this.accessToken = "";
      this.refreshToken = "";
      this.userName = "";
      this.nickName = "";
      this.role = "";
      clearStoredAuth();
    }
  }
});
