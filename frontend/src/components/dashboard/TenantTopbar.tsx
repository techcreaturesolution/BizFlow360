"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Menu,
  Bell,
  Search,
  LogOut,
  Building2,
  User,
  Shield,
  ExternalLink,
  ChevronDown,
  CheckCircle2,
  Check,
  Clock,
  Sparkles,
  CreditCard,
  Users2,
  Coins,
  Inbox,
} from "lucide-react";
import { clearAuth, getUser, getTenant } from "@/lib/storage";
import {
  getNotificationsList,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/tenant";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import type { LoginUser, TenantInfo } from "@/types/auth";
import type { NotificationItem } from "@/types/tenant";

interface TenantTopbarProps {
  onMenuToggle: () => void;
}

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Overview Dashboard",
  "/dashboard/analytics": "Analytics & Performance",
  "/dashboard/reports": "Reports & Export Center",
  "/dashboard/crm/pipeline": "Sales Pipeline Kanban",
  "/dashboard/crm/leads": "Leads Directory",
  "/dashboard/crm/customers": "Customer Accounts",
  "/dashboard/sales/products": "Product & Service Catalogue",
  "/dashboard/sales/quotations": "Sales Quotations",
  "/dashboard/sales/orders": "Customer Orders",
  "/dashboard/sales/invoices": "Sales Invoices",
  "/dashboard/finance/expenses": "Expense Tracking",
  "/dashboard/finance/receivables": "Accounts Receivable",
  "/dashboard/tasks": "Workflows & Tasks",
  "/dashboard/documents": "Document Vault",
  "/dashboard/approvals": "Governance & Approvals",
  "/dashboard/company": "Company Profile",
  "/dashboard/company/branches": "Branch Offices",
  "/dashboard/company/departments": "Departments",
  "/dashboard/company/teams": "Teams & Hierarchy",
  "/dashboard/team": "Team Members",
  "/dashboard/team/roles": "Roles & Permissions",
  "/dashboard/billing": "Subscription & Billing",
  "/dashboard/settings/notifications": "Notification Preferences",
  "/dashboard/notifications": "Notifications Center",
};

export function TenantTopbar({ onMenuToggle }: TenantTopbarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<LoginUser | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [recentNotifications, setRecentNotifications] = useState<NotificationItem[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState<boolean>(false);

  const fetchNotifications = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    getNotificationsList({ limit: 5 })
      .then((res) => {
        setUnreadCount(res.unreadCount);
        setRecentNotifications(res.notifications);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setUser(getUser());
    setTenant(getTenant());

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchNotifications();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setRecentNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.warn("Failed to mark notification read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setRecentNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn("Failed to mark all notifications read:", err);
    }
  };

  const getCategoryIcon = (category?: string) => {
    const c = category?.toUpperCase();
    if (c === "APPROVAL") return <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />;
    if (c === "BILLING") return <CreditCard className="w-3.5 h-3.5 text-emerald-600" />;
    if (c === "TEAM") return <Users2 className="w-3.5 h-3.5 text-purple-600" />;
    if (c === "SALES" || c === "FINANCE") return <Coins className="w-3.5 h-3.5 text-amber-600" />;
    return <Sparkles className="w-3.5 h-3.5 text-slate-500" />;
  };

  const handleLogout = () => {
    clearAuth();
    router.replace("/login");
  };

  const primaryRole = user?.roles?.[0] || "MEMBER";
  const getPageTitle = () => {
    if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
    if (pathname.startsWith("/dashboard/crm/leads/")) return "Lead Detail";
    if (pathname.startsWith("/dashboard/crm/customers/")) return "Customer Profile";
    return "Dashboard";
  };
  const pageTitle = getPageTitle();

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between">
      {/* Left side: Hamburger + Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuToggle}
          className="lg:hidden rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 truncate">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Center Search placeholder (desktop only) */}
      <div className="hidden md:flex items-center max-w-sm w-full mx-6">
        <div className="relative w-full">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            readOnly
            placeholder="Search leads, invoices, tasks... (⌘K)"
            className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3.5 text-xs text-slate-600 placeholder:text-slate-400 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
            onClick={() => router.push("/dashboard/tasks")}
          />
        </div>
      </div>

      {/* Right side: Tenant chip, Notifications, User menu */}
      <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
        {/* Workspace Chip */}
        {tenant && (
          <Link
            href="/dashboard/company"
            className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-200/80 transition-colors"
            title="Manage Workspace"
          >
            <Building2 className="h-3.5 w-3.5 text-indigo-600" />
            <span className="truncate max-w-[130px]">{tenant.name}</span>
          </Link>
        )}

        {/* Notifications Bell with Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsNotificationsOpen((prev) => !prev);
              setIsUserMenuOpen(false);
            }}
            className="relative rounded-xl p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none"
            title="Notifications"
            aria-label="View notifications"
            aria-expanded={isNotificationsOpen}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white shadow-xs animate-pulse">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Flyout Dropdown */}
          {isNotificationsOpen && (
            <div
              className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              onMouseLeave={() => setIsNotificationsOpen(false)}
            >
              {/* Header */}
              <div className="p-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {unreadCount} unread
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              {/* Notification items */}
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {recentNotifications.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <Inbox className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700">All caught up!</p>
                    <p className="text-[11px] text-slate-400">No new alerts at this time.</p>
                  </div>
                ) : (
                  recentNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleMarkAsRead(notif.id)}
                      className={`p-3.5 flex items-start gap-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                        !notif.isRead ? "bg-indigo-50/30" : ""
                      }`}
                    >
                      <div className="p-2 rounded-xl bg-white border border-slate-200 shrink-0 mt-0.5 shadow-2xs">
                        {getCategoryIcon(notif.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {notif.title}
                          </p>
                          {!notif.isRead && (
                            <span className="h-2 w-2 rounded-full bg-indigo-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(notif.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                <Link
                  href="/dashboard/notifications"
                  onClick={() => setIsNotificationsOpen(false)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1"
                >
                  <span>View all in Notification Center</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Pill & Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            className="flex items-center gap-2.5 rounded-full p-1 sm:px-2.5 sm:py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors focus:outline-none"
            aria-expanded={isUserMenuOpen}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white text-xs font-bold shadow-xs">
              {user?.fullName ? user.fullName.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="hidden sm:block text-left">
              <span className="block text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">
                {user?.fullName || "My Account"}
              </span>
              <span className="block text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">
                {primaryRole}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
          </button>

          {/* User Menu Dropdown */}
          {isUserMenuOpen && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
              onMouseLeave={() => setIsUserMenuOpen(false)}
            >
              <div className="px-4 py-2 border-b border-slate-100">
                <span className="block text-xs font-bold text-slate-900 truncate">
                  {user?.fullName}
                </span>
                <span className="block text-[11px] text-slate-400 truncate">
                  {user?.email}
                </span>
                <div className="mt-1">
                  <StatusBadge status={primaryRole} />
                </div>
              </div>

              <div className="py-1">
                <Link
                  href="/dashboard/company"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <span>Company Profile</span>
                </Link>
                <Link
                  href="/dashboard/billing"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Shield className="h-4 w-4 text-slate-400" />
                  <span>Subscription & Billing</span>
                </Link>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
