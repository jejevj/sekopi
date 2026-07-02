import { View, Text, Pressable } from "react-native";
import { Link } from "expo-router";
import { useAuthStore } from "@/lib/stores/authStore";
import { UserRole } from "@/lib/types/user";

const menuByRole: Record<UserRole, { label: string; href: string }[]> = {
  admin: [
    { label: "Dashboard", href: "/(admin)/dashboard" },
    { label: "Pengguna", href: "/(admin)/users" },
  ],
  produksi: [{ label: "Dashboard", href: "/(produksi)/dashboard" }],
  inventori: [{ label: "Dashboard", href: "/(inventori)/dashboard" }],
  driver: [{ label: "Pengiriman", href: "/(driver)/pengiriman" }],
  shareholder: [{ label: "Laporan", href: "/(shareholder)/laporan" }],
};

export function Sidebar() {
  const { user, logout } = useAuthStore();
  if (!user) return null;

  const menus = menuByRole[user.role] ?? [];

  return (
    <View className="w-64 h-full bg-card border-r border-border p-4">
      <Text className="text-xl font-bold text-foreground mb-6">☕ SekoPi</Text>
      {menus.map((item) => (
        <Link key={item.href} href={item.href as any} className="py-2 px-3 rounded-md text-foreground hover:bg-accent mb-1">
          {item.label}
        </Link>
      ))}
      <Pressable onPress={logout} className="mt-auto py-2 px-3">
        <Text className="text-destructive">Logout</Text>
      </Pressable>
    </View>
  );
}
