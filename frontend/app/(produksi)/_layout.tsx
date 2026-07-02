import { Tabs } from "expo-router";

export default function ProduksiLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="dashboard" options={{ title: "Produksi" }} />
    </Tabs>
  );
}
