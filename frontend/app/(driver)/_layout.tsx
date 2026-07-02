import { Tabs } from "expo-router";

export default function DriverLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="pengiriman" options={{ title: "Pengiriman" }} />
    </Tabs>
  );
}
