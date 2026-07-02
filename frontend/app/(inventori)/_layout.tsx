import { Tabs } from "expo-router";

export default function InventoriLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="dashboard" options={{ title: "Inventori" }} />
    </Tabs>
  );
}
