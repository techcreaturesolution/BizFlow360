"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  User,
  Building,
  Mail,
  Phone,
  Calendar,
  Clock,
  DollarSign,
  Tag,
  Edit2,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  MessageSquare,
  FileText,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Activity,
  CheckCircle,
  XCircle,
  Check,
} from "lucide-react";
import { getLeadDetail, updateFollowup } from "@/lib/crm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyText } from "@/components/ui/MoneyText";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/ErrorState";
import { ModuleLockedState } from "@/components/dashboard/ModuleLockedState";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { LeadUpsertModal } from "@/components/crm/LeadUpsertModal";
import { AssignLeadModal } from "@/components/crm/AssignLeadModal";
import { ConvertLeadModal } from "@/components/crm/ConvertLeadModal";
import { LogActivityModal } from "@/components/crm/LogActivityModal";
import { ScheduleFollowupModal } from "@/components/crm/ScheduleFollowupModal";
import type {
  LeadItem,
  LeadActivity,
  LeadFollowup,
  FollowupStatus,
} from "@/types/crm";

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;

  const [lead, setLead] = useState<LeadItem | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [followups, setFollowups] = useState<LeadFollowup[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status?: number; message: string } | null>(null);
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [showRaw, setShowRaw] = useState(false);

  // Modals state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [isLogActivityOpen, setIsLogActivityOpen] = useState(false);
  const [isScheduleFollowupOpen, setIsScheduleFollowupOpen] = useState(false);

  // Fetch lead detail, activities, and followups
  const loadDetail = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await getLeadDetail(leadId);
      setLead(res.lead);
      setActivities(res.activities);
      setFollowups(res.followups);
      setRawResponse(res.raw);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      const status = axiosErr.response?.status;
      const message = axiosErr.response?.data?.message || "Failed to load lead details.";
      setError({ status, message });
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // Handle followup status change
  const handleFollowupStatusChange = async (followupId: string, newStatus: FollowupStatus) => {
    try {
      const res = await updateFollowup(followupId, { status: newStatus });
      setFollowups((prev) =>
        prev.map((f) => (f.id === followupId ? res.followup : f))
      );
    } catch (err) {
      console.error("Failed to update followup status:", err);
    }
  };

  // 403 Module Entitlement check
  if (error?.status === 403 || error?.message.toLowerCase().includes("not enabled")) {
    return <ModuleLockedState moduleName="CRM" message={error.message} />;
  }

  if (loading) {
    return (
      <div className="space-y-6 pb-12">
        <Skeleton className="h-6 w-48 rounded-lg" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="p-8">
        <ErrorState
          title="Lead not found"
          message={error?.message || "Unable to locate this CRM lead."}
          onRetry={loadDetail}
        />
      </div>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "CALL":
        return <Phone className="h-4 w-4 text-emerald-600" />;
      case "EMAIL":
        return <Mail className="h-4 w-4 text-sky-600" />;
      case "MEETING":
        return <Calendar className="h-4 w-4 text-violet-600" />;
      case "STAGE_CHANGE":
        return <TrendingUp className="h-4 w-4 text-amber-600" />;
      case "ASSIGNMENT":
        return <UserCheck className="h-4 w-4 text-indigo-600" />;
      default:
        return <MessageSquare className="h-4 w-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/dashboard/crm/leads" className="hover:text-indigo-600 flex items-center gap-1">
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Leads Directory</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800 line-clamp-1">{lead.name}</span>
      </div>

      {/* Hero Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {lead.name}
              </h1>
              <StatusBadge status={lead.stage} />
              <StatusBadge status={lead.priority} />
              {lead.convertedCustomerId && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Converted Client
                </span>
              )}
            </div>

            {lead.companyName && (
              <div className="flex items-center gap-2 text-sm text-slate-600 font-semibold mt-1">
                <Building className="h-4 w-4 text-slate-400" />
                <span>{lead.companyName}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Edit2 className="h-3.5 w-3.5" />}
              onClick={() => setIsEditOpen(true)}
            >
              Edit Lead
            </Button>

            <Button
              variant="outline"
              size="sm"
              leftIcon={<UserCheck className="h-3.5 w-3.5" />}
              onClick={() => setIsAssignOpen(true)}
            >
              Assign
            </Button>

            {lead.convertedCustomerId ? (
              <Link href={`/dashboard/crm/customers/${lead.convertedCustomerId}`}>
                <Button
                  variant="primary"
                  size="sm"
                  rightIcon={<ExternalLink className="h-3.5 w-3.5" />}
                  className="bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/20"
                >
                  View Customer Profile
                </Button>
              </Link>
            ) : (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<CheckCircle2 className="h-4 w-4" />}
                onClick={() => setIsConvertOpen(true)}
                className="shadow-sm shadow-indigo-600/20"
              >
                Convert to Customer
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2/3): Details & Activity Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Deal Highlights */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-600" />
              <span>Prospect & Deal Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <span className="text-slate-400 font-medium block">Estimated Deal Value</span>
                <span className="text-base font-black text-slate-900 mt-0.5 block">
                  <MoneyText amount={lead.estimatedValue} currency={lead.currency || "INR"} />
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <span className="text-slate-400 font-medium block">Assigned Representative</span>
                <span className="text-xs font-bold text-slate-800 mt-1 block">
                  {lead.ownerName || "Unassigned"}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <span className="text-slate-400 font-medium block">Inbound Source</span>
                <span className="text-xs font-bold text-slate-800 mt-1 block">
                  {lead.source || "Direct / Unknown"}
                </span>
              </div>
            </div>

            {/* Contact Rows */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-100 text-slate-700">
                <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="font-medium">{lead.email || "No email recorded"}</span>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-100 text-slate-700">
                <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="font-medium">{lead.phone || "No phone recorded"}</span>
              </div>
            </div>

            {/* Notes Section */}
            {lead.notes && (
              <div className="pt-2">
                <span className="text-xs font-bold text-slate-700 block mb-1">
                  Requirement Details & Context
                </span>
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/60 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {lead.notes}
                </div>
              </div>
            )}

            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span>Created: {new Date(lead.createdAt).toLocaleString()}</span>
              <span>Last updated: {new Date(lead.updatedAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-600" />
                  <span>Activity & Engagement Timeline</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chronological audit of calls, emails, meetings, and stage changes.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setIsLogActivityOpen(true)}
              >
                Log Activity
              </Button>
            </div>

            {activities.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                <MessageSquare className="h-6 w-6 mx-auto text-slate-300 mb-1.5" />
                <p>No activity has been logged on this lead yet.</p>
                <button
                  onClick={() => setIsLogActivityOpen(true)}
                  className="mt-1 font-semibold text-indigo-600 hover:underline"
                >
                  Record first call or note
                </button>
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                {activities.map((act) => (
                  <div key={act.id} className="relative group">
                    {/* Timeline Node Icon */}
                    <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white ring-2 ring-slate-200 shadow-xs">
                      {getActivityIcon(act.activityType)}
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-bold text-slate-800">
                          {act.actorName || "Team Representative"}
                        </span>
                        <span className="text-slate-400">
                          {new Date(act.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-slate-900 mt-1">
                        {act.summary}
                      </p>

                      {act.details && (
                        <div className="text-[11px] text-slate-600 mt-1 whitespace-pre-wrap">
                          {String((act.details as Record<string, unknown>).notes || JSON.stringify(act.details))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1/3): Followups & Reminders */}
        <div className="space-y-6">
          {/* Followups Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span>Scheduled Follow-ups</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  {followups.filter((f) => f.status === "PENDING").length} pending tasks
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                leftIcon={<Plus className="h-3 w-3" />}
                onClick={() => setIsScheduleFollowupOpen(true)}
              >
                Schedule
              </Button>
            </div>

            {followups.length === 0 ? (
              <div className="py-6 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                <Clock className="h-6 w-6 mx-auto text-slate-300 mb-1" />
                <p>No follow-ups scheduled.</p>
                <button
                  onClick={() => setIsScheduleFollowupOpen(true)}
                  className="mt-1 font-semibold text-indigo-600 hover:underline text-[11px]"
                >
                  Set a reminder
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {followups.map((fol) => {
                  const isPending = fol.status === "PENDING";

                  return (
                    <div
                      key={fol.id}
                      className={`rounded-xl border p-3 text-xs transition-colors ${
                        isPending
                          ? "border-amber-200/80 bg-amber-50/40"
                          : "border-slate-200 bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <StatusBadge status={fol.status} />
                        <span className="text-[11px] font-semibold text-slate-700">
                          {new Date(fol.scheduledAt).toLocaleString([], {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>

                      {fol.notes && (
                        <p className="text-slate-700 text-[11px] mt-1.5 leading-relaxed">
                          {fol.notes}
                        </p>
                      )}

                      {/* Action buttons if pending */}
                      {isPending && (
                        <div className="mt-2.5 pt-2 border-t border-amber-200/60 flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleFollowupStatusChange(fol.id, "COMPLETED")}
                            className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1"
                          >
                            <Check className="h-3 w-3" />
                            Done
                          </button>
                          <button
                            onClick={() => handleFollowupStatusChange(fol.id, "CANCELLED")}
                            className="px-2 py-1 rounded text-[10px] font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions Shortcuts */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3 text-xs">
            <h4 className="font-bold text-slate-900">Next Recommended Action</h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Maintain momentum by logging prospect feedback right after meetings or scheduling subsequent pipeline demos.
            </p>

            <div className="space-y-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-left"
                leftIcon={<MessageSquare className="h-4 w-4 text-indigo-600" />}
                onClick={() => setIsLogActivityOpen(true)}
              >
                Log Phone or Video Call
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-left"
                leftIcon={<Calendar className="h-4 w-4 text-amber-600" />}
                onClick={() => setIsScheduleFollowupOpen(true)}
              >
                Schedule Follow-up Reminder
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dev-only raw response */}
      <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
        <span className="text-xs text-slate-400">Lead Detail • BizFlow360 CRM Engine</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRaw(!showRaw)}
          className="text-xs text-slate-500"
        >
          {showRaw ? "Hide Raw Response" : "Dev: Raw Response"}
        </Button>
      </div>

      {showRaw && Boolean(rawResponse) && (
        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4">
          <JsonViewer data={rawResponse} title={`GET /api/v1/crm/leads/${lead.id} Raw Payload`} />
        </div>
      )}

      {/* Edit Modal */}
      <LeadUpsertModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        leadToEdit={lead}
        onSuccess={(updated) => {
          setLead(updated);
          loadDetail();
        }}
      />

      {/* Assign Modal */}
      <AssignLeadModal
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        lead={lead}
        onSuccess={(updated) => {
          setLead(updated);
          loadDetail();
        }}
      />

      {/* Convert Modal */}
      <ConvertLeadModal
        isOpen={isConvertOpen}
        onClose={() => setIsConvertOpen(false)}
        lead={lead}
        onSuccess={(_cust, updatedLead) => {
          setLead(updatedLead);
          loadDetail();
        }}
      />

      {/* Log Activity Modal */}
      <LogActivityModal
        isOpen={isLogActivityOpen}
        onClose={() => setIsLogActivityOpen(false)}
        leadId={lead.id}
        leadName={lead.name}
        onSuccess={() => {
          loadDetail();
        }}
      />

      {/* Schedule Followup Modal */}
      <ScheduleFollowupModal
        isOpen={isScheduleFollowupOpen}
        onClose={() => setIsScheduleFollowupOpen(false)}
        leadId={lead.id}
        leadName={lead.name}
        defaultAssignedUserId={lead.ownerUserId}
        onSuccess={() => {
          loadDetail();
        }}
      />
    </div>
  );
}
