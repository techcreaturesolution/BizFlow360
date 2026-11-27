import React, { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input, type InputProps } from "./Input";

export interface PasswordInputProps extends Omit<InputProps, "type" | "rightIcon"> {}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ leftIcon = <Lock className="h-4 w-4" />, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <Input
        ref={ref}
        type={showPassword ? "text" : "password"}
        leftIcon={leftIcon}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="rounded p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
        {...props}
      />
    );
  }
);

PasswordInput.displayName = "PasswordInput";
