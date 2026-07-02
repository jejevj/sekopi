import { View, Text } from "react-native";

export default function LaporanPage() {
  return (
    <View className="flex-1 p-6 bg-background">
      <Text className="text-2xl font-bold text-foreground">Laporan & Performa</Text>
      <Text className="text-muted-foreground mt-2">Read-only view untuk pemegang saham</Text>
    </View>
  );
}
