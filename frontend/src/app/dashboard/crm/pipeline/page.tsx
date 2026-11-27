"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Kanban,
  Plus,
  RefreshCw,
  MoreVertical,
  ChevronRight,
  User,
  Building,
  DollarSign,
  Calendar,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  Layers,
  Sparkles,
  MoveRight,
} from "lucide-react";
import { getPipeline, getLeads, updateLead } from "@/lib/crm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyText } from "@/components/ui/MoneyText";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/ErrorState";
import { ModuleLockedState } from "@/components/dashboard/ModuleLockedState";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { LeadUpsertModal } from "@/components/crm/LeadUpsertModal";
import type {
  LeadItem,
  LeadStage,
  PipelineStageItem,
  NormalizedPagination,
} from "@/types/crm";

const COLUMNS: { stage: LeadStage; label: string; accentColor: string; bgBadge: string }[] = [
  { stage: "NEW", label: "New Leads", accentColor: "border-sky-500", bgBadge: "bg-sky-100 text-sky-700" },
  { stage: "CONTACTED", label: "Contacted", accentColor: "border-blue-500", bgBadge: "bg-blue-100 text-blue-700" },
  { stage: "QUALIFIED", label: "Qualified", accentColor: "border-indigo-500", bgBadge: "bg-indigo-100 text-indigo-700" },
  { stage: "PROPOSAL", label: "Proposal", accentColor: "border-amber-500", bgBadge: "bg-amber-100 text-amber-700" },
  { stage: "NEGOTIATION", label: "Negotiation", accentColor: "border-violet-500", bgBadge: "bg-violet-100 text-violet-700" },
  { stage: "WON", label: "Won", accentColor: "border-emerald-500", bgBadge: "bg-emerald-100 text-emerald-700" },
  { stage: "LOST", label: "Lost", accentColor: "border-rose-400", bgBadge: "bg-rose-100 text-rose-700" },
];

export default function PipelinePage() {
  const [pipelineSummary, setPipelineSummary] = useState<PipelineStageItem[]>([]);
  const [leadsByStage, setLeadsByStage] = useState<Record<LeadStage, LeadItem[]>>({
    NEW: [],
    CONTACTED: [],
    QUALIFIED: [],
    PROPOSAL: [],
    NEGOTIATION: [],
    WON: [],
    LOST: [],
  });

  const [paginationByStage, setPaginationByStage] = useState<
    Record<LeadStage, { page: number; totalPages: number; total: number; loadingMore: boolean }>
  >({
    NEW: { page: 1, totalPages: 1, total: 0, loadingMore: false },
    CONTACTED: { page: 1, totalPages: 1, total: 0, loadingMore: false },
    QUALIFIED: { page: 1, totalPages: 1, total: 0, loadingMore: false },
    PROPOSAL: { page: 1, totalPages: 1, total: 0, loadingMore: false },
    NEGOTIATION: { page: 1, totalPages: 1, total: 0, loadingMore: false },
    WON: { page: 1, totalPages: 1, total: 0, loadingMore: false },
    LOST: { page: 1, totalPages: 1, total: 0, loadingMore: false },
  });

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [error, setError] = useState<{ status?: number; message: string } | null>(null);
  const [rawResponse, setRawResponse] = useState<unknown>(null);
  const [showRaw, setShowRaw] = useState(false);

  // Modals & Menu
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeMenuLeadId, setActiveMenuLeadId] = useState<string | null>(null);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);

  // Fetch initial pipeline summary & leads for all columns
  const loadPipelineData = useCallback(async () => {
    setLoadingInitial(true);
    setError(null);

    try {
      // 1. Fetch stage totals
      const pipeRes = await getPipeline();
      setPipelineSummary(pipeRes.pipeline);
      setRawResponse(pipeRes.raw);

      // 2. Fetch cards for each stage in parallel
      const stagePromises = COLUMNS.map(async (col) => {
        const leadRes = await getLeads({ stage: col.stage, limit: 20, page: 1 });
        return {
          stage: col.stage,
          leads: leadRes.leads,
          pagination: leadRes.pagination,
        };
      });

      const stageResults = await Promise.all(stagePromises);

      const newLeadsMap: Record<LeadStage, LeadItem[]> = {
        NEW: [],
        CONTACTED: [],
        QUALIFIED: [],
        PROPOSAL: [],
        NEGOTIATION: [],
        WON: [],
        LOST: [],
      };

      const newPagMap: Record<
        LeadStage,
        { page: number; totalPages: number; total: number; loadingMore: boolean }
      > = {
        NEW: { page: 1, totalPages: 1, total: 0, loadingMore: false },
        CONTACTED: { page: 1, totalPages: 1, total: 0, loadingMore: false },
        QUALIFIED: { page: 1, totalPages: 1, total: 0, loadingMore: false },
        PROPOSAL: { page: 1, totalPages: 1, total: 0, loadingMore: false },
        NEGOTIATION: { page: 1, totalPages: 1, total: 0, loadingMore: false },
        WON: { page: 1, totalPages: 1, total: 0, loadingMore: false },
        LOST: { page: 1, totalPages: 1, total: 0, loadingMore: false },
      };

      stageResults.forEach((sr) => {
        newLeadsMap[sr.stage] = sr.leads;
        newPagMap[sr.stage] = {
          page: 1,
          totalPages: sr.pagination.totalPages,
          total: sr.pagination.total,
          loadingMore: false,
        };
      });

      setLeadsByStage(newLeadsMap);
      setPaginationByStage(newPagMap);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      const status = axiosErr.response?.status;
      const message = axiosErr.response?.data?.message || "Failed to load CRM pipeline data.";
      setError({ status, message });
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    loadPipelineData();
  }, [loadPipelineData]);

  // Load more cards for a specific stage column
  const handleLoadMore = async (stage: LeadStage) => {
    const current = paginationByStage[stage];
    if (current.loadingMore || current.page >= current.totalPages) return;

    setPaginationByStage((prev) => ({
      ...prev,
      [stage]: { ...prev[stage], loadingMore: true },
    }));

    try {
      const nextPage = current.page + 1;
      const res = await getLeads({ stage, limit: 20, page: nextPage });

      setLeadsByStage((prev) => ({
        ...prev,
        [stage]: [...prev[stage], ...res.leads],
      }));

      setPaginationByStage((prev) => ({
        ...prev,
        [stage]: {
          page: nextPage,
          totalPages: res.pagination.totalPages,
          total: res.pagination.total,
          loadingMore: false,
        },
      }));
    } catch (err) {
      console.error(`Failed to load more leads for ${stage}`, err);
      setPaginationByStage((prev) => ({
        ...prev,
        [stage]: { ...prev[stage], loadingMore: false },
      }));
    }
  };

  // Move lead card to another stage
  const handleMoveStage = async (leadId: string, fromStage: LeadStage, toStage: LeadStage) => {
    if (fromStage === toStage) return;

    const leadToMove = leadsByStage[fromStage].find((l) => l.id === leadId);
    if (!leadToMove) return;

    // Optimistic UI state update
    const updatedLead: LeadItem = { ...leadToMove, stage: toStage };

    setLeadsByStage((prev) => ({
      ...prev,
      [fromStage]: prev[fromStage].filter((l) => l.id !== leadId),
      [toStage]: [updatedLead, ...prev[toStage]],
    }));

    // Update column summary counts
    setPipelineSummary((prev) =>
      prev.map((s) => {
        if (s.stage === fromStage) {
          return {
            ...s,
            count: Math.max(0, s.count - 1),
            totalValue: Math.max(0, s.totalValue - leadToMove.estimatedValue),
          };
        }
        if (s.stage === toStage) {
          return {
            ...s,
            count: s.count + 1,
            totalValue: s.totalValue + leadToMove.estimatedValue,
          };
        }
        return s;
      })
    );

    setActiveMenuLeadId(null);

    try {
      await updateLead(leadId, { stage: toStage });
    } catch (err: unknown) {
      console.error("Failed to move lead stage, rolling back:", err);
      // Rollback on error
      setLeadsByStage((prev) => ({
        ...prev,
        [toStage]: prev[toStage].filter((l) => l.id !== leadId),
        [fromStage]: [leadToMove, ...prev[fromStage]],
      }));
      // Re-fetch accurate pipeline
      loadPipelineData();
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, leadId: string, stage: LeadStage) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.setData("text/plain", JSON.stringify({ leadId, fromStage: stage }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, stage: LeadStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStage !== stage) setDragOverStage(stage);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, toStage: LeadStage) => {
    e.preventDefault();
    setDragOverStage(null);
    setDraggedLeadId(null);

    const rawData = e.dataTransfer.getData("text/plain");
    if (!rawData) return;

    try {
      const { leadId, fromStage } = JSON.parse(rawData);
      if (leadId && fromStage && fromStage !== toStage) {
        handleMoveStage(leadId, fromStage, toStage);
      }
    } catch (parseErr) {
      console.error("Error parsing drag data", parseErr);
    }
  };

  // Total summary calculations
  const totalDeals = pipelineSummary.reduce((acc, s) => acc + s.count, 0);
  const totalPipelineValue = pipelineSummary.reduce((acc, s) => acc + s.totalValue, 0);

  // 403 Module Entitlement check
  if (error?.status === 403 || error?.message.toLowerCase().includes("not enabled")) {
    return <ModuleLockedState moduleName="CRM" message={error.message} />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
            <Kanban className="h-4 w-4" />
            <span>CRM & Deal Management</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Sales Pipeline Kanban
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Visualize deal conversion stages, manage lead velocity, and monitor pipeline values.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPipelineData}
            leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${loadingInitial ? "animate-spin" : ""}`} />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setIsCreateModalOpen(true)}
            className="shadow-sm shadow-indigo-600/20"
          >
            Create Lead
          </Button>
        </div>
      </div>

      {/* Pipeline Quick Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Total Active Deals</span>
            <h3 className="text-xl font-black text-slate-900 mt-1">{totalDeals}</h3>
          </div>
          <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Total Pipeline Value</span>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              <MoneyText amount={totalPipelineValue} currency="INR" />
            </h3>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Won Value</span>
            <h3 className="text-xl font-black text-emerald-700 mt-1">
              <MoneyText
                amount={pipelineSummary.find((s) => s.stage === "WON")?.totalValue || 0}
                currency="INR"
              />
            </h3>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Won Conversions</span>
            <h3 className="text-xl font-black text-emerald-700 mt-1">
              {pipelineSummary.find((s) => s.stage === "WON")?.count || 0} deals
            </h3>
          </div>
          <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600">
            <Kanban className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && !loadingInitial && (
        <ErrorState
          title="Could not load pipeline"
          message={error.message}
          onRetry={loadPipelineData}
        />
      )}

      {/* Kanban Board Container */}
      {loadingInitial ? (
        <div className="flex gap-4 overflow-x-auto pb-6">
          {COLUMNS.map((col) => (
            <div
              key={col.stage}
              className="w-72 shrink-0 rounded-2xl bg-slate-50/80 border border-slate-200 p-3 space-y-3"
            >
              <Skeleton className="h-8 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6 items-start scrollbar-thin">
          {COLUMNS.map((col) => {
            const summary = pipelineSummary.find((s) => s.stage === col.stage);
            const count = summary?.count ?? leadsByStage[col.stage]?.length ?? 0;
            const totalValue = summary?.totalValue ?? 0;
            const cards = leadsByStage[col.stage] || [];
            const pag = paginationByStage[col.stage];
            const isTarget = dragOverStage === col.stage;

            return (
              <div
                key={col.stage}
                onDragOver={(e) => handleDragOver(e, col.stage)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.stage)}
                className={`w-80 shrink-0 flex flex-col rounded-2xl bg-slate-100/70 border-t-4 ${
                  col.accentColor
                } border-x border-b border-slate-200/80 shadow-sm transition-colors duration-150 ${
                  isTarget ? "bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-300" : ""
                }`}
              >
                {/* Column Header */}
                <div className="p-3.5 border-b border-slate-200/70 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 tracking-tight">
                        {col.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${col.bgBadge}`}>
                        {count}
                      </span>
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                      <MoneyText amount={totalValue} currency="INR" />
                    </div>
                  </div>

                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="p-1 rounded-lg hover:bg-slate-200/60 text-slate-500 hover:text-slate-800 transition-colors"
                    title={`Add deal in ${col.label}`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Column Cards List */}
                <div className="p-2.5 space-y-2.5 min-h-[300px] max-h-[calc(100vh-280px)] overflow-y-auto">
                  {cards.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-300 rounded-xl text-slate-400">
                      <p className="text-xs">No deals in {col.label}</p>
                      <p className="text-[10px] mt-0.5">Drag card here to update stage</p>
                    </div>
                  ) : (
                    cards.map((lead) => {
                      const isDragging = draggedLeadId === lead.id;
                      const isMenuOpen = activeMenuLeadId === lead.id;

                      return (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, lead.id, col.stage)}
                          className={`relative rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm hover:shadow transition-all duration-150 cursor-grab active:cursor-grabbing group ${
                            isDragging ? "opacity-40 scale-95" : ""
                          }`}
                        >
                          {/* Card Top: Title & Move Dropdown */}
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/dashboard/crm/leads/${lead.id}`}
                              className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 hover:underline"
                            >
                              {lead.name}
                            </Link>

                            <div className="relative shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuLeadId(isMenuOpen ? null : lead.id);
                                }}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                                title="Move to stage"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>

                              {/* Stage Switch Dropdown Menu */}
                              {isMenuOpen && (
                                <div
                                  className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 z-30 animate-fadeIn"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Move to Stage
                                  </div>
                                  {COLUMNS.filter((c) => c.stage !== col.stage).map((targetCol) => (
                                    <button
                                      key={targetCol.stage}
                                      onClick={() => handleMoveStage(lead.id, col.stage, targetCol.stage)}
                                      className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center justify-between"
                                    >
                                      <span>{targetCol.label}</span>
                                      <MoveRight className="h-3 w-3 text-slate-400" />
                                    </button>
                                  ))}
                                  <div className="border-t border-slate-100 mt-1 pt-1">
                                    <Link
                                      href={`/dashboard/crm/leads/${lead.id}`}
                                      className="block px-2.5 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 font-medium"
                                    >
                                      View Full Record &rarr;
                                    </Link>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Company name if present */}
                          {lead.companyName && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 mt-0.5 font-medium line-clamp-1">
                              <Building className="h-3 w-3 text-slate-400 shrink-0" />
                              <span>{lead.companyName}</span>
                            </div>
                          )}

                          {/* Value & Priority */}
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-slate-900">
                              <MoneyText amount={lead.estimatedValue} currency={lead.currency || "INR"} />
                            </span>

                            <StatusBadge status={lead.priority} />
                          </div>

                          {/* Card Footer: Owner & Followup */}
                          <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-500">
                            <span className="flex items-center gap-1 line-clamp-1 max-w-[130px]">
                              <User className="h-3 w-3 text-slate-400 shrink-0" />
                              <span>{lead.ownerName || "Unassigned"}</span>
                            </span>

                            {lead.nextFollowupAt ? (
                              <span
                                className="flex items-center gap-1 font-medium text-amber-600"
                                title={`Next followup: ${new Date(lead.nextFollowupAt).toLocaleString()}`}
                              >
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>{new Date(lead.nextFollowupAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">No followup</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Load more cards */}
                  {pag.page < pag.totalPages && (
                    <button
                      onClick={() => handleLoadMore(col.stage)}
                      disabled={pag.loadingMore}
                      className="w-full py-2 text-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50/50 border border-slate-200 rounded-xl transition-all shadow-sm"
                    >
                      {pag.loadingMore ? "Loading more..." : `Load more (${pag.total - cards.length} left)`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dev-only raw response toggle */}
      <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
        <span className="text-xs text-slate-400">Pipeline Kanban Board • BizFlow360 CRM Engine</span>
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
          <JsonViewer data={rawResponse} title="GET /api/v1/crm/pipeline Raw Payload" />
        </div>
      )}

      {/* Create Lead Modal */}
      <LeadUpsertModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          loadPipelineData();
        }}
      />
    </div>
  );
}
