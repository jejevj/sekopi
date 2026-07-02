import { Pressable, Text } from "react-native";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "default" | "destructive" | "outline" | "ghost";
type ButtonSize = "default" | "sm" | "lg";

interface ButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
}

export function Button({
  onPress,
  children,
  variant = "default",
  size = "default",
  disabled = false,
  className,
}: ButtonProps) {
  const baseStyles = "rounded-md items-center justify-center flex-row";
  const variantStyles: Record<ButtonVariant, string> = {
    default: "bg-primary",
    destructive: "bg-destructive",
    outline: "border border-input bg-background",
    ghost: "bg-transparent",
  };
  const sizeStyles: Record<ButtonSize, string> = {
    default: "px-4 py-2",
    sm: "px-3 py-1.5",
    lg: "px-6 py-3",
  };
  const textStyles: Record<ButtonVariant, string> = {
    default: "text-primary-foreground font-medium",
    destructive: "text-destructive-foreground font-medium",
    outline: "text-foreground font-medium",
    ghost: "text-foreground font-medium",
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], disabled && "opacity-50", className)}
    >
      <Text className={cn(textStyles[variant])}>{children}</Text>
    </Pressable>
  );
}
