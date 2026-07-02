import React, { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { login } from "../../lib/auth";
import { getDashboardPath } from "../../lib/auth";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";

const loginSchema = z.object({
  email:    z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const { mutate, isPending, error } = useMutation({
    mutationFn: ({ email, password }: LoginForm) => login(email, password),
    onSuccess: (user) => {
      router.replace(getDashboardPath(user.role) as any);
    },
  });

  return (
    <View className="flex-1 bg-background">
      {/* Background blobs */}
      <View
        className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-20"
        style={{ backgroundColor: "#f44444", filter: "blur(80px)", transform: [{ translateX: -80 }, { translateY: -80 }] }}
      />
      <View
        className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-10"
        style={{ backgroundColor: "#f44444", filter: "blur(60px)", transform: [{ translateX: 40 }, { translateY: 40 }] }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow items-center justify-center px-6 py-12"
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / Brand */}
          <View className="items-center mb-10">
            <View className="w-20 h-20 rounded-2xl items-center justify-center mb-4 shadow-glow-md"
              style={{ backgroundColor: "#f44444" }}>
              <Text className="text-white text-4xl">☕</Text>
            </View>
            <Text className="text-3xl font-bold text-gradient-primary">SekoPi</Text>
            <Text className="text-muted-foreground text-sm mt-1">Sistem Manajemen Kopi Gerobakan</Text>
          </View>

          {/* Glass Card */}
          <View className="glass-card w-full max-w-sm animate-fade-in">
            <Text className="text-xl font-semibold text-foreground mb-6">Masuk ke Akun</Text>

            {/* Error message */}
            {error && (
              <View className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                <Text className="text-red-400 text-sm">
                  {(error as any)?.response?.data?.detail ?? "Email atau password salah"}
                </Text>
              </View>
            )}

            <View className="space-y-4">
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value, onBlur } }) => (
                  <Input
                    label="Email"
                    placeholder="admin@sekopi.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onChangeText={onChange}
                    value={value}
                    onBlur={onBlur}
                    error={errors.email?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value, onBlur } }) => (
                  <Input
                    label="Password"
                    placeholder="••••••••"
                    secureTextEntry={!showPass}
                    onChangeText={onChange}
                    value={value}
                    onBlur={onBlur}
                    error={errors.password?.message}
                    rightIcon={
                      <Pressable onPress={() => setShowPass(!showPass)}>
                        <Text className="text-muted-foreground text-xs">
                          {showPass ? "Sembunyikan" : "Tampilkan"}
                        </Text>
                      </Pressable>
                    }
                  />
                )}
              />
            </View>

            <Button
              className="w-full mt-6"
              size="lg"
              loading={isPending}
              onPress={handleSubmit((data) => mutate(data)) as any}
            >
              {isPending ? "Memproses..." : "Masuk"}
            </Button>

            <Text className="text-center text-xs text-muted-foreground mt-4">
              SekoPi v1.0 — © 2026
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
