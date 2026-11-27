"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Check,
  X,
  FileCheck,
  CreditCard,
  ShoppingBag,
  Calendar,
  AlertCircle,
  RefreshCw,
  GitFork,
  Network,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  ArrowRight,
  User,
} from "lucide-react";

import {
  getApprovalInbox,
  approveApprovalRequest,
  rejectApprovalRequest,
  getBranches,
  getDepartments,
} from "@/lib/tenant";
import {
  ApprovalItem,
  ApprovalStatus,
  ApprovalEntityType,
  BranchItem,
  DepartmentItem,
} from "@/types/tenant";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyText } from "@/components/ui/MoneyText";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/ErrorState";
import { JsonViewer } from "@/components/ui/JsonViewer";

const ENTITY_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  QUOTATION: {
    label: "Quotation",
    icon: <FileCheck className="w-3.5 h-3.5 text-indigo-600" />,
    color: "bg-indigo-50 border-indigo-200 text-indigo-700",
  },
  EXPENSE: {
    label: "Expense",
    icon: <CreditCard className="w-3.5 h-3.5 text-emerald-600" />,
    color: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  PURCHASE_ORDER: {
    label: "Purchase Order",
    icon: <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />,
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
  LEAVE_REQUEST: {
    label: "Leave Request",
    icon: <Calendar className="w-3.5 h-3.5 text-purple-600" />,
    color: "bg-purple-50 border-purple-200 text-purple-700",
  },
};

function ApprovalsInboxContent() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<ApprovalStatus>("PENDING");
  const [selectedEntityType, setSelectedEntityType] = useState<string>("ALL");
  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [page, setPage] = useState<number>(1);

  // Approve Decision Modal
  const [approveTarget, setApproveTarget] = useState<ApprovalItem | null>(null);
  const [approveComment, setApproveComment] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // Reject Decision Modal
  const [rejectTarget, setRejectTarget] = useState<ApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Success Feedback
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  const [showRawJson, setShowRawJson] = useState(false);
  const [rawInboxResponse, setRawInboxResponse] = useState<unknown>(null);

  useEffect(() => {
    getBranches().then((b) => setBranches(b)).catch(() => {});
    getDepartments().then((d) => setDepartments(d)).catch(() => {});
  }, []);

  const loadInbox = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setIsLoading(true);
      else setIsRefreshing(true);
      setErrorMsg(null);

      try {
        const res = await getApprovalInbox({
          status: activeTab,
          entityType: selectedEntityType !== "ALL" ? selectedEntityType : undefined,
          branchId: branchFilter !== "ALL" ? branchFilter : undefined,
          departmentId: departmentFilter !== "ALL" ? departmentFilter : undefined,
          page,
          limit: 20,
        });

        setApprovals(res.approvals);
        setPagination(res.pagination);
        setRawInboxResponse(res);
      } catch (err: unknown) {
        console.warn("Failed to load approval inbox:", err);
        setErrorMsg("Failed to load approvals queue. Please check network connection.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeTab, selectedEntityType, branchFilter, departmentFilter, page]
  );

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveTarget) return;

    setIsApproving(true);
    setApproveError(null);

    try {
      await approveApprovalRequest(approveTarget.id, {
        comment: approveComment.trim() || undefined,
      });

      setFeedbackSuccess(`Request "${approveTarget.title}" approved successfully.`);
      // Remove item from list immediately
      setApprovals((prev) => prev.filter((item) => item.id !== approveTarget.id));
      setApproveTarget(null);
      setApproveComment("");

      // Background refresh
      loadInbox(true);
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { status?: number; data?: { message?: string; error?: string } };
      };
      const statusCode = errorObj?.response?.status;
      const msg =
        errorObj?.response?.data?.message ||
        errorObj?.response?.data?.error ||
        "Failed to approve request.";

      if (statusCode === 409) {
        setApproveError("This request has already been decided by another reviewer. Refreshing...");
        setTimeout(() => {
          setApproveTarget(null);
          loadInbox(true);
        }, 1500);
      } else {
        setApproveError(msg);
      }
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;

    if (!rejectReason.trim()) {
      setRejectError("A rejection reason is strictly required before declining.");
      return;
    }

    setIsRejecting(true);
    setRejectError(null);

    try {
      await rejectApprovalRequest(rejectTarget.id, {
        reason: rejectReason.trim(),
        comment: rejectComment.trim() || undefined,
      });

      setFeedbackSuccess(`Request "${rejectTarget.title}" rejected.`);
      // Remove item from list immediately
      setApprovals((prev) => prev.filter((item) => item.id !== rejectTarget.id));
      setRejectTarget(null);
      setRejectReason("");
      setRejectComment("");

      // Background refresh
      loadInbox(true);
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { status?: number; data?: { message?: string; error?: string } };
      };
      const statusCode = errorObj?.response?.status;
      const msg =
        errorObj?.response?.data?.message ||
        errorObj?.response?.data?.error ||
        "Failed to reject request.";

      if (statusCode === 409) {
        setRejectError("This request has already been decided by another reviewer. Refreshing...");
        setTimeout(() => {
          setRejectTarget(null);
          loadInbox(true);
        }, 1500);
      } else {
        setRejectError(msg);
      }
    } finally {
      setIsRejecting(false);
    }
  };

  const statusTabs: { status: ApprovalStatus; label: string }[] = [
    { status: "PENDING", label: "Pending Approval" },
    { status: "APPROVED", label: "Approved" },
    { status: "REJECTED", label: "Rejected" },
    { status: "CANCELLED", label: "Cancelled" },
  ];

  const entityTypes = [
    { key: "ALL", label: "All Request Types" },
    { key: "QUOTATION", label: "Quotations" },
    { key: "EXPENSE", label: "Expenses" },
    { key: "PURCHASE_ORDER", label: "Purchase Orders" },
    { key: "LEAVE_REQUEST", label: "Leave Requests" },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Governance & Approvals
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <CheckCircle2 className="w-3 h-3" /> Inbox
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Review, authorize, or decline financial quotations, employee expenses, and operational orders.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadInbox(true)}
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
              Dev Mode Inspector: GET /api/v1/approvals/inbox
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Total Count: {pagination.total}
            </span>
          </div>
          <JsonViewer data={rawInboxResponse} defaultExpanded={true} />
        </div>
      )}

      {/* Success Feedback Banner */}
      {feedbackSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-800 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{feedbackSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Status Tabs Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto space-x-2">
        {statusTabs.map((tab) => {
          const isActive = activeTab === tab.status;
          return (
            <button
              key={tab.status}
              type="button"
              onClick={() => {
                setActiveTab(tab.status);
                setPage(1);
              }}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
                isActive
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              <span>{tab.label}</span>
              {isActive && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {pagination.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Entity Type Chips & Dropdown Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Entity Type Chips */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {entityTypes.map((et) => {
              const isSelected = selectedEntityType === et.key;
              return (
                <button
                  key={et.key}
                  type="button"
                  onClick={() => {
                    setSelectedEntityType(et.key);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {et.label}
                </button>
              );
            })}
          </div>

          {/* Branch & Dept Selects */}
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <select
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>

            <select
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => loadInbox()}>
            Retry
          </Button>
        </div>
      )}

      {/* Approvals Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : approvals.length === 0 ? (
          <EmptyState
            title={`No ${activeTab.toLowerCase()} requests`}
            description={`There are currently no approval items in "${activeTab}" status matching your filters.`}
            icon={<CheckCircle2 className="w-8 h-8 text-slate-400" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Request Item</th>
                  <th className="py-3.5 px-6">Category</th>
                  <th className="py-3.5 px-6">Amount</th>
                  <th className="py-3.5 px-6">Requester</th>
                  <th className="py-3.5 px-6">Submitted</th>
                  <th className="py-3.5 px-6">Status / Decision</th>
                  {activeTab === "PENDING" && (
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {approvals.map((req) => {
                  const typeMeta = ENTITY_TYPE_LABELS[req.entityType] || {
                    label: req.entityType,
                    icon: <FileCheck className="w-3.5 h-3.5" />,
                    color: "bg-slate-100 border-slate-200 text-slate-700",
                  };

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Title & Entity Number */}
                      <td className="py-4 px-6 font-bold text-slate-900">
                        <div>
                          <div className="flex items-center gap-2">
                            {req.entityNumber && (
                              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                {req.entityNumber}
                              </span>
                            )}
                            <span className="font-bold text-slate-900">{req.title}</span>
                          </div>
                          {req.decisionComment && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-normal mt-1 italic">
                              <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>Decision: {req.decisionComment}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Entity Type Category */}
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${typeMeta.color}`}
                        >
                          {typeMeta.icon}
                          <span>{typeMeta.label}</span>
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-6 font-bold text-slate-900">
                        {req.amount !== null && req.amount !== undefined ? (
                          <MoneyText
                            amount={req.amount}
                            currency={req.currency || "INR"}
                            className="text-xs"
                          />
                        ) : (
                          <span className="text-slate-400 font-normal italic">—</span>
                        )}
                      </td>

                      {/* Requester */}
                      <td className="py-4 px-6 text-slate-600">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                            {req.requestedBy?.fullName?.charAt(0) || "U"}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800 block">
                              {req.requestedBy?.fullName || "Staff Member"}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {req.requestedBy?.email || ""}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Created At */}
                      <td className="py-4 px-6 text-slate-500 font-medium">
                        {req.createdAt
                          ? new Date(req.createdAt).toLocaleDateString(undefined, {
                              dateStyle: "medium",
                            })
                          : "—"}
                      </td>

                      {/* Status / Decision Info */}
                      <td className="py-4 px-6">
                        <StatusBadge status={req.status} />
                      </td>

                      {/* Action buttons (Approve / Reject) for PENDING */}
                      {activeTab === "PENDING" && (
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setApproveTarget(req);
                                setApproveComment("");
                                setApproveError(null);
                              }}
                              className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-2xs gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setRejectTarget(req);
                                setRejectReason("");
                                setRejectComment("");
                                setRejectError(null);
                              }}
                              className="h-8 px-3 text-xs text-rose-700 bg-white hover:bg-rose-50 border-rose-200 font-semibold rounded-lg gap-1"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!isLoading && pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-800">{approvals.length}</span> of{" "}
              <span className="font-semibold text-slate-800">{pagination.total}</span> approval items
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

      {/* Approve Comment Modal */}
      <Modal
        isOpen={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        title="Approve Request"
        description={`Authorizing "${approveTarget?.title}"`}
        maxWidth="md"
      >
        <form onSubmit={handleApproveSubmit} className="space-y-4">
          {approveError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-800">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{approveError}</span>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
            <p className="font-bold text-slate-900">{approveTarget?.title}</p>
            {approveTarget?.amount !== null && approveTarget?.amount !== undefined && (
              <p className="text-slate-600 font-medium">
                Value:{" "}
                <MoneyText
                  amount={approveTarget.amount}
                  currency={approveTarget.currency || "INR"}
                />
              </p>
            )}
            <p className="text-slate-500">
              Submitted by: {approveTarget?.requestedBy?.fullName || "Staff Member"}
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Approval Comment / Audit Note (Optional)
            </label>
            <textarea
              rows={3}
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              placeholder="e.g. Approved within quarterly department budget allowance."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setApproveTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isApproving}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 py-2 rounded-xl"
            >
              {isApproving ? "Approving..." : "Confirm Approval"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reject Reason Modal (Reason REQUIRED) */}
      <Modal
        isOpen={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title="Reject Request"
        description={`Declining "${rejectTarget?.title}"`}
        maxWidth="md"
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          {rejectError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-800">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{rejectError}</span>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
            <p className="font-bold text-slate-900">{rejectTarget?.title}</p>
            {rejectTarget?.amount !== null && rejectTarget?.amount !== undefined && (
              <p className="text-slate-600 font-medium">
                Value:{" "}
                <MoneyText
                  amount={rejectTarget.amount}
                  currency={rejectTarget.currency || "INR"}
                />
              </p>
            )}
            <p className="text-slate-500">
              Submitted by: {rejectTarget?.requestedBy?.fullName || "Staff Member"}
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Rejection Reason <span className="text-rose-500">* Required</span>
            </label>
            <textarea
              rows={3}
              required
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                setRejectError(null);
              }}
              placeholder="e.g. Exceeds department spending policy without secondary vendor comparison quote."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              This explanation will be permanently recorded in the audit log and emailed to the requester.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Additional Note (Optional)
            </label>
            <input
              type="text"
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              placeholder="e.g. Please resubmit with revised pricing."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isRejecting || !rejectReason.trim()}
              size="sm"
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-5 py-2 rounded-xl disabled:opacity-50"
            >
              {isRejecting ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-4">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      }
    >
      <ApprovalsInboxContent />
    </Suspense>
  );
}
