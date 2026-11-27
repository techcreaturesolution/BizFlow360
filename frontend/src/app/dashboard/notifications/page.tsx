"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  Check,
  CreditCard,
  Users2,
  Coins,
  Sparkles,
  Inbox,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  Sliders,
} from "lucide-react";

import {
  getNotificationsList,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/tenant";
import {
  NotificationItem,
  NotificationCategory,
} from "@/types/tenant";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/ErrorState";
import { JsonViewer } from "@/components/ui/JsonViewer";

const CATEGORY_META: Record<
  string,
  { label: string; icon: React.ReactNode; badgeClass: string }
> = {
  APPROVAL: {
    label: "Approvals",
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />,
    badgeClass: "bg-indigo-50 border-indigo-200 text-indigo-700",
  },
  BILLING: {
    label: "Billing",
    icon: <CreditCard className="w-3.5 h-3.5 text-emerald-600" />,
    badgeClass: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  TEAM: {
    label: "Team",
    icon: <Users2 className="w-3.5 h-3.5 text-purple-600" />,
    badgeClass: "bg-purple-50 border-purple-200 text-purple-700",
  },
  SALES: {
    label: "Sales",
    icon: <Coins className="w-3.5 h-3.5 text-amber-600" />,
    badgeClass: "bg-amber-50 border-amber-200 text-amber-700",
  },
  FINANCE: {
    label: "Finance",
    icon: <Coins className="w-3.5 h-3.5 text-blue-600" />,
    badgeClass: "bg-blue-50 border-blue-200 text-blue-700",
  },
  GENERAL: {
    label: "General",
    icon: <Sparkles className="w-3.5 h-3.5 text-slate-500" />,
    badgeClass: "bg-slate-100 border-slate-200 text-slate-700",
  },
};

function NotificationsCenterContent() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [readFilter, setReadFilter] = useState<"ALL" | "UNREAD" | "READ">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [page, setPage] = useState<number>(1);

  const [showRawJson, setShowRawJson] = useState(false);
  const [rawResponse, setRawResponse] = useState<unknown>(null);

  const loadNotifications = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setIsLoading(true);
      else setIsRefreshing(true);
      setErrorMsg(null);

      try {
        const isReadParam =
          readFilter === "UNREAD" ? "false" : readFilter === "READ" ? "true" : undefined;

        const res = await getNotificationsList({
          isRead: isReadParam,
          category: categoryFilter !== "ALL" ? categoryFilter : undefined,
          page,
          limit: 20,
        });

        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount);
        setPagination(res.pagination);
        setRawResponse(res);
      } catch (err: unknown) {
        console.warn("Failed to load notifications:", err);
        setErrorMsg("Failed to load notifications. Please check your network connection.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [readFilter, categoryFilter, page]
  );

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.warn("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn("Failed to mark all as read:", err);
    }
  };

  const categories = [
    { key: "ALL", label: "All Categories" },
    { key: "APPROVAL", label: "Approvals" },
    { key: "BILLING", label: "Billing" },
    { key: "TEAM", label: "Team" },
    { key: "SALES", label: "Sales" },
    { key: "FINANCE", label: "Finance" },
    { key: "GENERAL", label: "General" },
  ];

  return (
    <div className="space-y-6 pb-16 max-w-5xl">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Notifications Center
            </h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time activity feed for approvals, subscription billing, and workspace updates.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/settings/notifications"
            className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Preferences</span>
          </Link>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              className="h-9 px-3 gap-1.5 text-xs text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 border-indigo-200 font-semibold"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadNotifications(true)}
            disabled={isRefreshing}
            className="h-9 px-3 gap-1.5 text-xs text-slate-700 bg-white hover:bg-slate-50 border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
            <span>Refresh</span>
          </Button>

          {process.env.NODE_ENV !== "production" && (
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="text-xs font-mono font-medium text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors"
            >
              {showRawJson ? "Hide Raw" : "Raw JSON"}
            </button>
          )}
        </div>
      </div>

      {/* Dev Mode Raw JSON Inspector */}
      {showRawJson && (
        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white overflow-hidden shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              Dev Mode Inspector: GET /api/v1/notifications
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Unread: {unreadCount} | Total: {pagination.total}
            </span>
          </div>
          <JsonViewer data={rawResponse} defaultExpanded={true} />
        </div>
      )}

      {/* Read Status Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/80 w-fit">
        {[
          { key: "ALL", label: "All Alerts" },
          { key: "UNREAD", label: `Unread (${unreadCount})` },
          { key: "READ", label: "Archived / Read" },
        ].map((tab) => {
          const isSelected = readFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setReadFilter(tab.key as "ALL" | "UNREAD" | "READ");
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isSelected
                  ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Category Chips Bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        {categories.map((cat) => {
          const isSelected = categoryFilter === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => {
                setCategoryFilter(cat.key);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                isSelected
                  ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => loadNotifications()}>
            Retry
          </Button>
        </div>
      )}

      {/* Notifications Feed */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            title="No notifications to display"
            description="You are completely up to date with workspace activity and approvals."
            icon={<Inbox className="w-8 h-8 text-slate-400" />}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notif) => {
              const meta = CATEGORY_META[notif.category?.toUpperCase() || ""] || {
                label: notif.category || "General",
                icon: <Sparkles className="w-3.5 h-3.5 text-slate-500" />,
                badgeClass: "bg-slate-100 border-slate-200 text-slate-700",
              };

              return (
                <div
                  key={notif.id}
                  onClick={() => !notif.isRead && handleMarkAsRead(notif.id)}
                  className={`p-4 sm:p-5 flex items-start gap-4 hover:bg-slate-50/70 transition-colors ${
                    !notif.isRead ? "bg-indigo-50/30" : "bg-white"
                  } ${!notif.isRead ? "cursor-pointer" : ""}`}
                >
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 shrink-0 shadow-2xs mt-0.5">
                    {meta.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {notif.title}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                      </div>

                      <span className="text-[11px] text-slate-400 whitespace-nowrap">
                        {new Date(notif.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {notif.message}
                    </p>

                    <div className="flex items-center justify-between gap-2 mt-2.5">
                      {notif.entityType && (
                        <span className="text-[10px] font-mono font-medium text-slate-400">
                          Ref: {notif.entityType}
                        </span>
                      )}

                      {!notif.isRead && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notif.id);
                          }}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 ml-auto flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Mark as read</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {!isLoading && pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-800">{notifications.length}</span> of{" "}
              <span className="font-semibold text-slate-800">{pagination.total}</span> alerts
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 px-2.5 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Previous
              </Button>

              <span className="font-medium text-slate-700 px-2">
                Page {page} of {pagination.totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="h-8 px-2.5 text-xs"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NotificationsCenterPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-4">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      }
    >
      <NotificationsCenterContent />
    </Suspense>
  );
}
