import React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, helperText, leftIcon, rightIcon, id, required, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const effectiveHint = hint || helperText;
    const errorId = error && inputId ? `${inputId}-error` : undefined;
    const hintId = effectiveHint && inputId ? `${inputId}-hint` : undefined;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
          >
            {label}
            {required && <span className="ml-1 text-rose-500">*</span>}
          </label>
        )}

        <div className="relative rounded-lg shadow-sm">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={!!error}
            aria-describedby={cn(errorId, hintId)}
            className={cn(
              "block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200",
              "focus:outline-none focus:ring-4 focus:ring-indigo-500/10",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error
                ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15"
                : "border-slate-300 hover:border-slate-400 focus:border-indigo-600",
              props.disabled && "cursor-not-allowed bg-slate-50 text-slate-500",
              className
            )}
            {...props}
          />

          {rightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {rightIcon}
            </div>
          )}
        </div>

        {effectiveHint && !error && (
          <p id={hintId} className="text-xs text-slate-500">
            {effectiveHint}
          </p>
        )}

        {error && (
          <div id={errorId} className="flex items-center gap-1.5 text-xs font-medium text-rose-600 animate-fadeIn" role="alert">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
