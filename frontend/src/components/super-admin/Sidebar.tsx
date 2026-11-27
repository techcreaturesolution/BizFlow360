"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers,
  LayoutDashboard,
  Building2,
  Package,
  RefreshCcw,
  Receipt,
  CreditCard,
  ScrollText,
  ChevronRight,
  Server,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const navLinks = [
    {
      title: "Overview",
      href: "/super-admin/dashboard",
      icon: <LayoutDashboard className="h-4.5 w-4.5" />,
    },
    {
      title: "Tenants",
      href: "/super-admin/tenants",
      icon: <Building2 className="h-4.5 w-4.5" />,
    },
    {
      title: "Plans",
      href: "/super-admin/plans",
      icon: <Package className="h-4.5 w-4.5" />,
    },
    {
      title: "Subscriptions",
      href: "/super-admin/subscriptions",
      icon: <RefreshCcw className="h-4.5 w-4.5" />,
    },
    {
      title: "Invoices",
      href: "/super-admin/invoices",
      icon: <Receipt className="h-4.5 w-4.5" />,
    },
    {
      title: "Payments",
      href: "/super-admin/payments",
      icon: <CreditCard className="h-4.5 w-4.5" />,
    },
    {
      title: "Audit Logs",
      href: "/super-admin/audit-logs",
      icon: <ScrollText className="h-4.5 w-4.5" />,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden animate-fadeIn"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 w-64 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col transition-transform duration-300 ease-in-out border-r border-slate-800",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Top Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800/80">
          <Link href="/super-admin/dashboard" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-md shadow-indigo-500/20 ring-1 ring-white/10 group-hover:scale-105 transition-transform">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
                BizFlow
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </span>
              <span className="block text-[10px] uppercase font-bold tracking-widest text-indigo-400 -mt-1">
                Super Admin
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Platform Modules
          </div>

          {navLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/super-admin/dashboard" && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group",
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-300 hover:text-white hover:bg-white/[0.08]"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "shrink-0 transition-colors",
                      isActive ? "text-white" : "text-slate-400 group-hover:text-white"
                    )}
                  >
                    {link.icon}
                  </span>
                  <span>{link.title}</span>
                </div>
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-indigo-200" />}
              </Link>
            );
          })}
        </div>

        {/* Bottom Status Card */}
        <div className="p-3.5 border-t border-slate-800/80">
          <div className="rounded-xl bg-white/[0.04] p-3 border border-white/[0.08] space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Server className="h-3.5 w-3.5 text-emerald-400" />
              <span>Platform Online</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Role: <span className="font-bold text-indigo-400">SUPER_ADMIN</span>
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-400 hover:text-indigo-300 transition-colors"
            >
              <span>Tenant View</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
