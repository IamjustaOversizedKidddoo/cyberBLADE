import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconOnly?: boolean;
}

/**
 * Tactical HUD Button component with high contrast keyboard focus and micro-interactions.
 * Respects prefers-reduced-motion via CSS.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    loading = false,
    iconOnly = false,
    disabled,
    children,
    className = "",
    type = "button",
    ...props
  },
  ref,
) {
  const baseStyles =
    "inline-flex items-center justify-center font-ui font-medium tracking-wide transition-all select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-void";

  const sizeStyles = {
    sm: iconOnly ? "h-7 w-7 text-xs" : "h-7 px-2.5 text-xs gap-1.5",
    md: iconOnly ? "h-9 w-9 text-sm" : "h-9 px-3.5 text-sm gap-2",
    lg: iconOnly ? "h-11 w-11 text-base" : "h-11 px-5 text-base gap-2.5",
  }[size];

  const variantStyles = {
    primary:
      "bg-cyan text-void font-semibold shadow-[0_0_15px_rgba(15,190,255,0.3)] hover:bg-cyan/90 hover:shadow-[0_0_20px_rgba(15,190,255,0.5)] active:translate-y-px",
    secondary:
      "bg-surface text-ink border border-line hover:border-cyan/60 hover:text-cyan hover:bg-surface-raised active:translate-y-px",
    ghost:
      "bg-transparent text-muted hover:text-ink hover:bg-surface active:translate-y-px",
    danger:
      "bg-danger/10 text-danger border border-danger/40 hover:bg-danger/20 hover:border-danger hover:text-ink active:translate-y-px",
  }[variant];

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading ? "true" : undefined}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <svg
            className="animate-spin h-3.5 w-3.5 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {!iconOnly && <span>{children}</span>}
        </>
      ) : (
        children
      )}
    </button>
  );
});
