import { Link, Stack } from "expo-router";
import { View, Text } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-xl font-bold text-foreground">Halaman tidak ditemukan</Text>
        <Link href="/" className="mt-4 text-primary">
          Kembali ke Beranda
        </Link>
      </View>
    </>
  );
}
