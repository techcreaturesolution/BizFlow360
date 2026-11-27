"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Building,
  Mail,
  Phone,
  Calendar,
  Clock,
  Edit2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  DollarSign,
  UserCheck,
} from "lucide-react";
import { getLeads } from "@/lib/crm";
import { getTeamMembers } from "@/lib/tenant";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyText } from "@/components/ui/MoneyText";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/ErrorState";
import { ModuleLockedState } from "@/components/dashboard/ModuleLockedState";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { LeadUpsertModal } from "@/components/crm/LeadUpsertModal";
import type {
  LeadItem,
  LeadStage,
  LeadPriority,
  NormalizedPagination,
} from "@/types/crm";
import type { TeamMember } from "@/types/tenant";

const STAGE_FILTER_OPTIONS = [
  { value: "ALL", label: "All Deal Stages" },
  { value: "NEW", label: "New Leads" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];

const PRIORITY_FILTER_OPTIONS = [
  { value: "ALL", label: "All Priorities" },
  { value: "LOW", label: "Low Priority" },
  { value: "MEDIUM", label: "Medium Priority" },
  { value: "HIGH", label: "High Priority" },
  { value: "URGENT", label: "Urgent Priority" },
];

export default function LeadsDirectoryPage() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [pagination, setPagination] = useState<NormalizedPagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<LeadStage | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<LeadPriority | "ALL">("ALL");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status?: number; message: string } | null>(null);
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [showRaw, setShowRaw] = useState(false);

  // Modals
  const [isUpsertOpen, setIsUpsertOpen] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState<LeadItem | null>(null);

  // Debounce search query 400ms
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((prev: NormalizedPagination) => ({ ...prev, page: 1 }));
    }, 400);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [search]);

  // Load team members once for owner dropdown
  useEffect(() => {
    getTeamMembers({ limit: 100 })
      .then((res) => setTeamMembers(res.members || []))
      .catch(() => {});
  }, []);

  // Fetch leads
  const fetchLeads = useCallback(
    async (pageToLoad = pagination.page) => {
      setLoading(true);
      setError(null);

      try {
        const res = await getLeads({
          stage: stageFilter !== "ALL" ? stageFilter : undefined,
          priority: priorityFilter !== "ALL" ? priorityFilter : undefined,
          ownerUserId: ownerFilter !== "ALL" ? ownerFilter : undefined,
          search: debouncedSearch.trim() || undefined,
          page: pageToLoad,
          limit: pagination.limit,
        });

        setLeads(res.leads);
        setPagination(res.pagination);
        setRawResponse(res.raw);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
        const status = axiosErr.response?.status;
        const message = axiosErr.response?.data?.message || "Failed to load CRM leads.";
        setError({ status, message });
      } finally {
        setLoading(false);
      }
    },
    [pagination.page, pagination.limit, stageFilter, priorityFilter, ownerFilter, debouncedSearch]
  );

  useEffect(() => {
    fetchLeads(pagination.page);
  }, [fetchLeads, pagination.page]);

  // 403 Module Entitlement check
  if (error?.status === 403 || error?.message.toLowerCase().includes("not enabled")) {
    return <ModuleLockedState moduleName="CRM" message={error.message} />;
  }

  const ownerOptions = [
    { value: "ALL", label: "All Sales Representatives" },
    ...teamMembers.map((m) => ({
      value: m.userId,
      label: m.fullName,
    })),
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
            <Users className="h-4 w-4" />
            <span>CRM & Deal Management</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Leads Directory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Maintain prospect accounts, qualify inquiries, and monitor deal opportunities.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/dashboard/crm/pipeline">
            <Button variant="outline" size="sm">
              View Pipeline Kanban &rarr;
            </Button>
          </Link>

          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setLeadToEdit(null);
              setIsUpsertOpen(true);
            }}
            className="shadow-sm shadow-indigo-600/20"
          >
            Create Lead
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, company, email..."
              leftIcon={<Search className="h-4 w-4 text-slate-400" />}
            />
          </div>

          <div>
            <Select
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value as LeadStage | "ALL");
                setPagination((prev: NormalizedPagination) => ({ ...prev, page: 1 }));
              }}
              options={STAGE_FILTER_OPTIONS}
            />
          </div>

          <div>
            <Select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value as LeadPriority | "ALL");
                setPagination((prev: NormalizedPagination) => ({ ...prev, page: 1 }));
              }}
              options={PRIORITY_FILTER_OPTIONS}
            />
          </div>

          <div>
            <Select
              value={ownerFilter}
              onChange={(e) => {
                setOwnerFilter(e.target.value);
                setPagination((prev: NormalizedPagination) => ({ ...prev, page: 1 }));
              }}
              options={ownerOptions}
            />
          </div>
        </div>

        {(stageFilter !== "ALL" || priorityFilter !== "ALL" || ownerFilter !== "ALL" || search) && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>
              Showing filtered leads ({pagination.total} matching records)
            </span>
            <button
              onClick={() => {
                setSearch("");
                setStageFilter("ALL");
                setPriorityFilter("ALL");
                setOwnerFilter("ALL");
                setPagination((prev: NormalizedPagination) => ({ ...prev, page: 1 }));
              }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Leads Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {error ? (
          <div className="p-6">
            <ErrorState
              title="Failed to load leads"
              message={error.message}
              onRetry={() => fetchLeads(1)}
            />
          </div>
        ) : loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : leads.length === 0 ? (
          <div className="p-10">
            <EmptyState
              title="No leads found"
              description="No prospect or deal records match your active filters. Create a new lead to start nurturing opportunities."
              actionLabel="Create Lead"
              onAction={() => {
                setLeadToEdit(null);
                setIsUpsertOpen(true);
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Lead Contact</th>
                  <th className="py-3.5 px-4">Communication</th>
                  <th className="py-3.5 px-4">Deal Stage</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4 text-right">Est. Value</th>
                  <th className="py-3.5 px-4">Assigned Representative</th>
                  <th className="py-3.5 px-4">Next Followup</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors group">
                    {/* Lead Contact & Company */}
                    <td className="py-3.5 px-4">
                      <div>
                        <Link
                          href={`/dashboard/crm/leads/${lead.id}`}
                          className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors hover:underline text-xs"
                        >
                          {lead.name}
                        </Link>
                        {lead.companyName && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Building className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{lead.companyName}</span>
                          </div>
                        )}
                        {lead.source && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 mt-1">
                            {lead.source}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Contact Details */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        {lead.email ? (
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{lead.email}</span>
                          </div>
                        ) : null}
                        {lead.phone ? (
                          <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                            <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{lead.phone}</span>
                          </div>
                        ) : null}
                        {!lead.email && !lead.phone && (
                          <span className="text-slate-400 text-[11px]">No contact added</span>
                        )}
                      </div>
                    </td>

                    {/* Stage */}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={lead.stage} />
                    </td>

                    {/* Priority */}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={lead.priority} />
                    </td>

                    {/* Estimated Value */}
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      <MoneyText amount={lead.estimatedValue} currency={lead.currency || "INR"} />
                    </td>

                    {/* Owner */}
                    <td className="py-3.5 px-4">
                      <span className="text-slate-700 font-medium">
                        {lead.ownerName || "Unassigned"}
                      </span>
                    </td>

                    {/* Followup */}
                    <td className="py-3.5 px-4">
                      {lead.nextFollowupAt ? (
                        <div className="flex items-center gap-1.5 text-amber-700 font-medium text-[11px]">
                          <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span>{new Date(lead.nextFollowupAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">None scheduled</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setLeadToEdit(lead);
                            setIsUpsertOpen(true);
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                          title="Edit Lead"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        <Link
                          href={`/dashboard/crm/leads/${lead.id}`}
                          className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 hover:text-indigo-800 transition-colors font-medium flex items-center gap-1"
                          title="View Lead Details"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer / Pagination */}
        {!loading && leads.length > 0 && (
          <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing page <strong className="text-slate-800">{pagination.page}</strong> of{" "}
              <strong className="text-slate-800">{pagination.totalPages}</strong> ({pagination.total} total leads)
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev: NormalizedPagination) => ({ ...prev, page: prev.page - 1 }))}
                leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
              >
                Previous
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev: NormalizedPagination) => ({ ...prev, page: prev.page + 1 }))}
                rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dev-only raw toggle */}
      <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
        <span className="text-xs text-slate-400">Leads Table • BizFlow360 CRM Engine</span>
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
          <JsonViewer data={rawResponse} title="GET /api/v1/crm/leads Raw Payload" />
        </div>
      )}

      {/* Create / Edit Modal */}
      <LeadUpsertModal
        isOpen={isUpsertOpen}
        onClose={() => {
          setIsUpsertOpen(false);
          setLeadToEdit(null);
        }}
        leadToEdit={leadToEdit}
        onSuccess={() => {
          fetchLeads(pagination.page);
        }}
      />
    </div>
  );
}
