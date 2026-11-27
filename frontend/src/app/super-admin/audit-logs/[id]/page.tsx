"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldAlert,
  Clock,
  User,
  Building,
  RefreshCw,
  Copy,
  Check,
  Layers,
  FileCode,
  Tag,
} from "lucide-react";

import { getAuditLog, parsePlatformError } from "@/lib/platform";
import type { AuditLogDetail } from "@/types/platform";
import { DiffTable } from "@/components/super-admin/DiffTable";
import { JsonViewer } from "@/components/super-admin/JsonViewer";
import { ErrorState } from "@/components/super-admin/ErrorState";
import { Button } from "@/components/ui/Button";

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function AuditLogDetailPage() {
  const params = useParams();
  const logId = params?.id as string;
  const router = useRouter();

  const [log, setLog] = useState<AuditLogDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchLogDetail = useCallback(async () => {
    if (!logId) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await getAuditLog(logId);
      setLog(data);
    } catch (err: unknown) {
      setError(parsePlatformError(err));
    } finally {
      setIsLoading(false);
    }
  }, [logId]);

  useEffect(() => {
    fetchLogDetail();
  }, [fetchLogDetail]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-slate-200 rounded" />
        <div className="h-10 w-64 bg-slate-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-52 bg-slate-200 rounded-xl md:col-span-2" />
          <div className="h-52 bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !log) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/super-admin/audit-logs")}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          Back to Audit Logs
        </Button>
        <ErrorState
          title="Audit Record Not Found"
          message={error || "The requested audit log entry could not be located."}
          onRetry={fetchLogDetail}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button and Header */}
      <div>
        <Link
          href="/super-admin/audit-logs"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Audit Logs</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xl font-bold tracking-tight text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                  {log.action}
                </span>
                <span className="text-xs text-slate-400 capitalize font-medium">
                  {log.entity_type} #{log.entity_id ? log.entity_id.slice(0, 8) : "N/A"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Recorded on {formatDateTime(log.created_at)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLogDetail}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Metadata Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Metadata */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Tag className="h-4 w-4 text-indigo-600" />
            <span>Event Context & Justification</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block mb-1">Target Entity</span>
              <div className="font-semibold text-slate-800 capitalize">
                {log.entity_type}
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 mt-0.5">
                <span className="truncate max-w-[200px]">{log.entity_id || "None"}</span>
                {log.entity_id && (
                  <button
                    onClick={() => copyToClipboard(log.entity_id!, "entity_id")}
                    className="text-slate-400 hover:text-slate-700"
                    title="Copy Entity ID"
                  >
                    {copiedKey === "entity_id" ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block mb-1">Tenant Organization</span>
              <div className="font-semibold text-slate-800">
                {log.tenant_name || "Platform-Level (Global)"}
              </div>
              {log.tenant_id && (
                <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                  ID: {log.tenant_id}
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 sm:col-span-2">
              <span className="text-slate-400 block mb-1">Audit Justification / Reason</span>
              <p className="text-slate-800 font-medium leading-relaxed">
                {log.reason || "No explicit reason was supplied for this mutation."}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Log ID:</span>
              <span className="truncate max-w-[180px]">{log.id}</span>
              <button
                onClick={() => copyToClipboard(log.id, "log_id")}
                className="text-slate-400 hover:text-slate-700"
                title="Copy Log ID"
              >
                {copiedKey === "log_id" ? (
                  <Check className="h-3 w-3 text-emerald-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>

            {log.request_id && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Request ID:</span>
                <span className="truncate max-w-[180px]">{log.request_id}</span>
                <button
                  onClick={() => copyToClipboard(log.request_id!, "req_id")}
                  className="text-slate-400 hover:text-slate-700"
                  title="Copy Request ID"
                >
                  {copiedKey === "req_id" ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Actor Info Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <User className="h-4 w-4 text-indigo-600" />
            <span>Actor Identity</span>
          </h2>

          {log.actor ? (
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Full Name</span>
                <span className="font-bold text-slate-900 text-sm">
                  {log.actor.full_name}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Email Address</span>
                <span className="font-mono text-slate-700">{log.actor.email}</span>
              </div>

              {log.actor.id && (
                <div>
                  <span className="text-slate-400 block mb-0.5">User ID</span>
                  <span className="font-mono text-slate-500 text-[11px] truncate block">
                    {log.actor.id}
                  </span>
                </div>
              )}

              {log.actor.roles && log.actor.roles.length > 0 && (
                <div>
                  <span className="text-slate-400 block mb-1">Assigned Roles</span>
                  <div className="flex flex-wrap gap-1">
                    {log.actor.roles.map((r, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">
              <span className="font-semibold text-slate-700 block mb-1">
                Automated System Event
              </span>
              This action was dispatched automatically by platform background workers or an inbound webhook event.
            </div>
          )}
        </div>
      </div>

      {/* Before / After Diff Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileCode className="h-5 w-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">
            Field-Level State Modifications (Diff)
          </h2>
        </div>

        {/* Diff Table */}
        <DiffTable diff={log.diff} />
      </div>

      {/* Full State Payloads (Before & After) */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">
          Full Snapshots Before & After Mutation
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <JsonViewer
            data={log.before_data}
            title="Before Data Snapshot"
            defaultExpanded={false}
          />
          <JsonViewer
            data={log.after_data}
            title="After Data Snapshot"
            defaultExpanded={false}
          />
        </div>
      </div>
    </div>
  );
}
