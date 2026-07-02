import { View, Text } from "react-native";

export default function AdminDashboard() {
  return (
    <View className="flex-1 p-6 bg-background">
      <Text className="text-2xl font-bold text-foreground">Admin Dashboard</Text>
      <Text className="text-muted-foreground mt-2">Welcome back, Admin</Text>
    </View>
  );
}
