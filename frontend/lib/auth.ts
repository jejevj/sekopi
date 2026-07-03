import { api, TokenStore } from "./api";
import { useAuthStore, AuthUser } from "../stores/authStore";

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: number;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
  };
}

export async function login(email: string, password: string): Promise<AuthUser> {
  // OAuth2PasswordRequestForm requires application/x-www-form-urlencoded
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  const { data } = await api.post<LoginResponse>(
    "/auth/login",
    formData.toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  const user: AuthUser = {
    id: data.user.id,
    email: data.user.email,
    nama: data.user.full_name,
    role: data.user.role.toUpperCase() as AuthUser["role"],
  };

  // Simpan access_token + refresh_token ke SecureStore
  await useAuthStore.getState().setAuth(user, data.access_token, data.refresh_token);

  // Set default header untuk request berikutnya
  api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`;

  return user;
}

export async function logout(): Promise<void> {
  delete api.defaults.headers.common["Authorization"];
  await useAuthStore.getState().clearAuth();
}

export function getDashboardPath(role: string): string {
  switch (role.toUpperCase()) {
    case "ADMIN":       return "/(admin)/dashboard";
    case "PRODUKSI":    return "/(admin)/dashboard";
    case "INVENTORI":   return "/(inventori)/stok";
    case "DRIVER":      return "/(driver)/pengiriman";
    case "SHAREHOLDER": return "/(shareholder)/laporan";
    default:            return "/(admin)/dashboard";
  }
}
