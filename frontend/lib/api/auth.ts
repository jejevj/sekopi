import { apiClient } from "./client";

export interface LoginPayload {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export const authApi = {
  login: async (payload: LoginPayload): Promise<TokenResponse> => {
    const form = new URLSearchParams();
    form.append("username", payload.username);
    form.append("password", payload.password);
    const { data } = await apiClient.post<TokenResponse>("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return data;
  },
  getMe: async () => {
    const { data } = await apiClient.get("/auth/me");
    return data;
  },
};
