import { TextInput, View, Text } from "react-native";
import { cn } from "@/lib/utils/cn";

interface InputProps {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  label?: string;
  secureTextEntry?: boolean;
  className?: string;
  error?: string;
}

export function Input({ value, onChangeText, placeholder, label, secureTextEntry, className, error }: InputProps) {
  return (
    <View className="gap-1.5">
      {label && <Text className="text-sm font-medium text-foreground">{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        placeholderTextColor="hsl(var(--muted-foreground))"
        className={cn(
          "rounded-md border border-input bg-background px-3 py-2 text-foreground",
          error && "border-destructive",
          className
        )}
      />
      {error && <Text className="text-sm text-destructive">{error}</Text>}
    </View>
  );
}
