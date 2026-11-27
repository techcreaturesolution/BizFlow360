"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "full";
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "full";
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  noPadding?: boolean;
  contentClassName?: string;
  isDirty?: boolean;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth,
  size,
  icon,
  badge,
  footer,
  noPadding = false,
  contentClassName,
  isDirty = false,
  triggerRef,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAttemptClose = () => {
    if (isDirty) {
      const confirmDiscard = window.confirm(
        "You have unsaved changes. Are you sure you want to close and discard them?"
      );
      if (!confirmDiscard) return;
    }
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleAttemptClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);

      // Focus first focusable element inside modal container
      const timeout = setTimeout(() => {
        if (modalContainerRef.current) {
          const focusable = modalContainerRef.current.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          focusable?.focus();
        }
      }, 50);

      return () => {
        clearTimeout(timeout);
        document.body.style.overflow = "unset";
        window.removeEventListener("keydown", handleKeyDown);

        // Return focus to trigger button
        if (triggerRef?.current) {
          triggerRef.current.focus();
        }
      };
    }
  }, [isOpen, isDirty, triggerRef]);

  if (!mounted || !isOpen) return null;

  const effectiveWidth = maxWidth || size || "lg";

  const maxWidthClass = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-xl",
    "2xl": "sm:max-w-2xl",
    "3xl": "sm:max-w-3xl",
    "4xl": "sm:max-w-4xl",
    full: "sm:max-w-[95vw]",
  }[effectiveWidth] || "sm:max-w-lg";

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-headline-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleAttemptClose();
        }
      }}
    >
      <div
        ref={modalContainerRef}
        className={cn(
          "relative w-full rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[92dvh] sm:max-h-[88vh] flex flex-col animate-in fade-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200",
          maxWidthClass
        )}
      >
        {/* Mobile Pull Indicator */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-white">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        {/* Sticky Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white/95 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-3">
            {icon && (
              <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-xs">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  id="modal-headline-title"
                  className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate"
                >
                  {title}
                </h3>
                {badge}
              </div>
              {description && (
                <p className="text-xs text-slate-500 mt-0.5 truncate sm:whitespace-normal">
                  {description}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAttemptClose}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        {noPadding ? (
          <div className={cn("overflow-hidden flex-1 flex flex-col min-h-0", contentClassName)}>
            {children}
          </div>
        ) : (
          <div className={cn("px-6 py-5 overflow-y-auto flex-1 min-h-0 scrollbar-thin scrollbar-thumb-slate-200", contentClassName)}>
            {children}
          </div>
        )}

        {/* Optional Sticky Footer */}
        {footer && (
          <div className="border-t border-slate-200 bg-slate-50/95 backdrop-blur-sm px-6 py-3.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
