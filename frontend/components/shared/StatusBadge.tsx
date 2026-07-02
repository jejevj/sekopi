import React from "react";
import { cn, STATUS_COLORS, STATUS_LABELS } from "../../lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status.toLowerCase()] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30";
  const label = STATUS_LABELS[status.toLowerCase()] ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        colorClass,
        className
      )}
    >
      {label}
    </span>
  );
}
