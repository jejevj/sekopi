import React, { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { useAuthStore } from "../../stores/authStore";
import { View, ActivityIndicator } from "react-native";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, initFromStorage } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initFromStorage();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/");
    }
  }, [user, isLoading, segments]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#f44444" />
      </View>
    );
  }

  return <>{children}</>;
}
