import { Tabs } from "expo-router";

export default function AdminLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="users/index" options={{ title: "Users" }} />
    </Tabs>
  );
}
