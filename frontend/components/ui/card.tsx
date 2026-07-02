import { View, Text } from "react-native";
import { cn } from "@/lib/utils/cn";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <View className={cn("rounded-lg border border-border bg-background p-4 shadow-sm", className)}>
      {children}
    </View>
  );
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <View className={cn("mb-3", className)}>{children}</View>;
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <Text className={cn("text-lg font-semibold text-foreground", className)}>{children}</Text>;
}

export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <View className={cn("", className)}>{children}</View>;
}
