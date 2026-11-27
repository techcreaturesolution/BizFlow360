"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Menu, LogOut, Shield, User } from "lucide-react";
import { clearAuth, getUser } from "@/lib/storage";
import { Button } from "@/components/ui/Button";

interface TopbarProps {
  onMenuToggle: () => void;
  title: string;
  description?: string;
}

export function Topbar({ onMenuToggle, title, description }: TopbarProps) {
  const router = useRouter();
  const user = getUser();

  const handleLogout = () => {
    clearAuth();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <h1 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
            {title}
          </h1>
          {description && (
            <p className="text-xs text-slate-500 hidden sm:block -mt-0.5">{description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Super Admin User Pill */}
        <div className="flex items-center gap-2.5 rounded-full bg-slate-50 border border-slate-200 py-1 px-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold shadow-sm">
            {user?.fullName?.charAt(0) || "S"}
          </div>
          <div className="hidden sm:block text-left">
            <span className="block text-xs font-bold text-slate-900 leading-tight">
              {user?.fullName || "Super Admin"}
            </span>
            <span className="block text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">
              Platform Admin
            </span>
          </div>
        </div>

        {/* Sign Out Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          leftIcon={<LogOut className="h-3.5 w-3.5 text-slate-500" />}
          className="text-xs font-semibold text-slate-700 hover:text-rose-600 hover:border-rose-300"
        >
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}
