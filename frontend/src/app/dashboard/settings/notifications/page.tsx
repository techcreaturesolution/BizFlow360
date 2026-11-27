"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  Mail,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCcw,
  RefreshCw,
  Sliders,
  Shield,
  FileCheck,
  CreditCard,
  Users2,
  Inbox,
  CheckSquare,
  MessageSquare,
  Clock,
  Sparkles,
} from "lucide-react";

import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/tenant";
import { NotificationPreferences } from "@/types/tenant";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { JsonViewer } from "@/components/ui/JsonViewer";

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailApprovals: true,
  emailBilling: true,
  emailTeamUpdates: true,
  emailDigestDaily: false,
  inAppApprovals: true,
  inAppBilling: true,
  inAppMentions: true,
  inAppTasks: true,
};

function NotificationPreferencesContent() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [savedPreferences, setSavedPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  const [showRawJson, setShowRawJson] = useState(false);

  const loadPreferences = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    try {
      const data = await getNotificationPreferences();
      setPreferences(data);
      setSavedPreferences(data);
    } catch (err: unknown) {
      console.warn("Failed to load notification preferences:", err);
      setLoadError("Unable to retrieve notification preferences. Using default settings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const hasUnsavedChanges = useMemo(() => {
    return (
      preferences.emailApprovals !== savedPreferences.emailApprovals ||
      preferences.emailBilling !== savedPreferences.emailBilling ||
      preferences.emailTeamUpdates !== savedPreferences.emailTeamUpdates ||
      preferences.emailDigestDaily !== savedPreferences.emailDigestDaily ||
      preferences.inAppApprovals !== savedPreferences.inAppApprovals ||
      preferences.inAppBilling !== savedPreferences.inAppBilling ||
      preferences.inAppMentions !== savedPreferences.inAppMentions ||
      preferences.inAppTasks !== savedPreferences.inAppTasks
    );
  }, [preferences, savedPreferences]);

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setSaveSuccessMsg(null);
  };

  const handleDiscard = () => {
    setPreferences(savedPreferences);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    try {
      const updated = await updateNotificationPreferences(preferences);
      setPreferences(updated);
      setSavedPreferences(updated);
      setSaveSuccessMsg("Your notification preferences have been saved successfully.");
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { message?: string; error?: string } };
      };
      const msg =
        errorObj?.response?.data?.message ||
        errorObj?.response?.data?.error ||
        "Failed to save preferences. Please check connection.";
      setSaveErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 pb-16 max-w-4xl">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-96 rounded-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 max-w-4xl">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Notification Preferences
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Sliders className="w-3 h-3" /> Alert Settings
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Choose which alerts trigger external emails versus real-time in-app dashboard badges.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/notifications"
            className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors"
          >
            <Bell className="w-3.5 h-3.5 text-indigo-600" />
            <span>Open Notifications</span>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={loadPreferences}
            className="h-9 px-3 gap-1.5 text-xs text-slate-700 bg-white hover:bg-slate-50 border-slate-200"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload</span>
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
              Dev Mode Inspector: GET/PUT /api/v1/notification-preferences
            </span>
          </div>
          <JsonViewer data={preferences} defaultExpanded={true} />
        </div>
      )}

      {/* Success / Error Banners */}
      {saveSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-800">
            <p className="font-semibold text-emerald-900">Preferences Updated</p>
            <p className="mt-0.5">{saveSuccessMsg}</p>
          </div>
        </div>
      )}

      {saveErrorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800">
            <p className="font-semibold text-rose-900">Save Failed</p>
            <p className="mt-0.5">{saveErrorMsg}</p>
          </div>
        </div>
      )}

      {loadError && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
          {loadError}
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* GROUP 1: Email Notifications */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Email Notifications</h2>
              <p className="text-xs text-slate-500">
                Control which critical workspace actions dispatch messages to your registered email.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {/* emailApprovals */}
            <div className="py-3.5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900">
                  Approval Requests & Decisions
                </p>
                <p className="text-[11px] text-slate-500">
                  Notify when a quotation, expense, or purchase order requires your sign-off or receives a decision.
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.emailApprovals}
                onChange={() => handleToggle("emailApprovals")}
                className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
              />
            </div>

            {/* emailBilling */}
            <div className="py-3.5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900">
                  Subscription, Invoices & Payment Alerts
                </p>
                <p className="text-[11px] text-slate-500">
                  Receive invoice receipts, renewal countdowns, quota warnings, and payment past-due alerts.
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.emailBilling}
                onChange={() => handleToggle("emailBilling")}
                className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
              />
            </div>

            {/* emailTeamUpdates */}
            <div className="py-3.5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900">
                  Team Members & Invitations
                </p>
                <p className="text-[11px] text-slate-500">
                  Get notified when an invitation is accepted, staff role is upgraded, or membership changes.
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.emailTeamUpdates}
                onChange={() => handleToggle("emailTeamUpdates")}
                className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
              />
            </div>

            {/* emailDigestDaily */}
            <div className="py-3.5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900">
                  Daily Morning Executive Digest
                </p>
                <p className="text-[11px] text-slate-500">
                  Receive a consolidated morning email summarizing pipeline updates, open tasks, and overdue receivables.
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.emailDigestDaily}
                onChange={() => handleToggle("emailDigestDaily")}
                className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
              />
            </div>
          </div>
        </div>

        {/* GROUP 2: In-App Notifications */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">In-App Alerts & Badges</h2>
              <p className="text-xs text-slate-500">
                Real-time bell notification flyouts and desktop badges while using BizFlow.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {/* inAppApprovals */}
            <div className="py-3.5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900">
                  Pending Approvals
                </p>
                <p className="text-[11px] text-slate-500">
                  Live bell indicators when quotations, purchase orders, or employee expenses require review.
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.inAppApprovals}
                onChange={() => handleToggle("inAppApprovals")}
                className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
              />
            </div>

            {/* inAppBilling */}
            <div className="py-3.5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900">
                  Subscription & Billing Events
                </p>
                <p className="text-[11px] text-slate-500">
                  In-app notifications when invoices are generated, payments succeed, or trials approach renewal.
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.inAppBilling}
                onChange={() => handleToggle("inAppBilling")}
                className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
              />
            </div>

            {/* inAppMentions */}
            <div className="py-3.5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900">
                  Direct Mentions & Internal Notes
                </p>
                <p className="text-[11px] text-slate-500">
                  Notify when a colleague mentions you or comments on a CRM lead, invoice, or team task.
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.inAppMentions}
                onChange={() => handleToggle("inAppMentions")}
                className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
              />
            </div>

            {/* inAppTasks */}
            <div className="py-3.5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900">
                  Task Assignments & Due Deadlines
                </p>
                <p className="text-[11px] text-slate-500">
                  Notify when you are assigned a project task, checklist item, or operational action.
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.inAppTasks}
                onChange={() => handleToggle("inAppTasks")}
                className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
              />
            </div>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-between pt-2">
          {hasUnsavedChanges ? (
            <span className="text-xs font-semibold text-amber-600 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              You have unsaved preference changes
            </span>
          ) : (
            <span className="text-xs text-slate-400">
              All preferences are saved and up to date.
            </span>
          )}

          <div className="flex items-center gap-2.5">
            {hasUnsavedChanges && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDiscard}
                className="text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Discard
              </Button>
            )}

            <Button
              type="submit"
              disabled={isSaving || !hasUnsavedChanges}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-6 py-2.5 rounded-xl shadow-xs gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Preferences</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NotificationPreferencesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-4 max-w-4xl">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <NotificationPreferencesContent />
    </Suspense>
  );
}
