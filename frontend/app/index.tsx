import { Redirect } from "expo-router";
import { useAuthStore } from "../stores/authStore";
import { getDashboardPath } from "../lib/auth";

export default function Index() {
  const { user } = useAuthStore();
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href={getDashboardPath(user.role) as any} />;
}
