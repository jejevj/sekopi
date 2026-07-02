import { Tabs } from "expo-router";

export default function ShareholderLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="laporan" options={{ title: "Laporan" }} />
    </Tabs>
  );
}
