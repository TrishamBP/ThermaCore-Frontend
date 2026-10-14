import type { ButtonHTMLAttributes } from "react";

import { cn } from "./cn";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "secondary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-sm font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-[13px]",
        variant === "primary" && "bg-accent text-on-accent hover:bg-fg-2",
        variant === "secondary" && "border border-line-strong bg-raised text-fg hover:border-fg-3",
        variant === "ghost" && "text-fg-2 hover:bg-raised hover:text-fg",
        variant === "danger" && "border border-crit/60 bg-crit/10 text-crit hover:bg-crit/20",
        className,
      )}
      {...props}
    />
  );
}
