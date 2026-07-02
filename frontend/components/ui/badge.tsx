import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-primary-500/20 border-primary-500/30 text-primary-400",
        secondary:   "glass border-white/20 text-foreground",
        destructive: "bg-red-500/20 border-red-500/30 text-red-400",
        success:     "bg-green-500/20 border-green-500/30 text-green-400",
        warning:     "bg-yellow-500/20 border-yellow-500/30 text-yellow-400",
        info:        "bg-blue-500/20 border-blue-500/30 text-blue-400",
        outline:     "border-white/20 text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
