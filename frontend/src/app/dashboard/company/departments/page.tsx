"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import {
  Network,
  Plus,
  Search,
  Building,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Edit2,
  PowerOff,
  Power,
  RefreshCw,
  GitFork,
  ShieldAlert,
  Users,
} from "lucide-react";

import {
  getDepartmentsList,
  createDepartment,
  updateDepartment,
  getBranches,
  getUsersList,
} from "@/lib/tenant";
import {
  DepartmentItem,
  CreateDepartmentInput,
  BranchItem,
  StaffUserItem,
} from "@/types/tenant";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/ErrorState";
import { JsonViewer } from "@/components/ui/JsonViewer";

function DepartmentsContent() {
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUserItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Modal Form Inputs
  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState<string>("");
  const [managerUserId, setManagerUserId] = useState<string>("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  // Toggle Status Confirm Dialog
  const [statusChangeTarget, setStatusChangeTarget] = useState<DepartmentItem | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [showRawJson, setShowRawJson] = useState(false);

  // Load auxiliary data: branches and users
  useEffect(() => {
    getBranches().then((b) => setBranches(b)).catch(() => {});
    getUsersList().then((u) => setStaffUsers(u)).catch(() => {});
  }, []);

  const loadDepartments = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMsg(null);

    try {
      const data = await getDepartmentsList({
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        branchId: branchFilter !== "ALL" ? branchFilter : undefined,
        search: searchQuery.trim() || undefined,
      });
      setDepartments(data);
    } catch (err: unknown) {
      console.warn("Failed to load departments:", err);
      setErrorMsg("Failed to load departments. Please check your connection.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter, branchFilter, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDepartments();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadDepartments]);

  const openCreateModal = () => {
    setEditingDept(null);
    setName("");
    setBranchId(branches[0]?.id || "");
    setManagerUserId("");
    setStatus("ACTIVE");
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (dept: DepartmentItem) => {
    setEditingDept(dept);
    setName(dept.name || "");
    setBranchId(dept.branchId || "");
    setManagerUserId(dept.managerUserId || "");
    setStatus((dept.status as "ACTIVE" | "INACTIVE") || "ACTIVE");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!name.trim()) {
      setModalError("Department Name is required.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: CreateDepartmentInput = {
        name: name.trim(),
        branchId: branchId.trim() ? branchId.trim() : null,
        managerUserId: managerUserId.trim() ? managerUserId.trim() : null,
        status,
      };

      if (editingDept) {
        await updateDepartment(editingDept.id, payload);
      } else {
        await createDepartment(payload);
      }

      setIsModalOpen(false);
      await loadDepartments(true);
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { message?: string; error?: string } };
      };
      const message =
        errorObj?.response?.data?.message ||
        errorObj?.response?.data?.error ||
        "Failed to save department. Please check inputs.";
      setModalError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!statusChangeTarget) return;
    setIsUpdatingStatus(true);
    try {
      const nextStatus = statusChangeTarget.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await updateDepartment(statusChangeTarget.id, {
        status: nextStatus,
      });
      setStatusChangeTarget(null);
      await loadDepartments(true);
    } catch (err: unknown) {
      console.warn("Failed to update department status:", err);
      alert("Unable to change department status. Please try again.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getBranchLabel = (id?: string | null) => {
    if (!id) return "All Locations / Central";
    const b = branches.find((item) => item.id === id);
    return b ? `${b.name} (${b.code})` : "Assigned Branch";
  };

  const getManagerLabel = (id?: string | null) => {
    if (!id) return "Unassigned";
    const u = staffUsers.find((user) => user.userId === id || (user as unknown as { id: string }).id === id);
    return u ? u.fullName : "Department Head";
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Departments & Units
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Network className="w-3 h-3" /> Organizational Units
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Structure your operational divisions, branch assignments, and department leadership.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDepartments(true)}
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

          <Button
            onClick={openCreateModal}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Department</span>
          </Button>
        </div>
      </div>

      {/* Dev Mode Inspector */}
      {showRawJson && (
        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white overflow-hidden shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              Dev Mode Inspector: GET /api/v1/departments
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Total: {departments.length}
            </span>
          </div>
          <JsonViewer data={departments} defaultExpanded={true} />
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search departments..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Branch Filter */}
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="w-full sm:w-56 px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <span className="text-xs font-semibold text-slate-500">Status:</span>
          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200/80">
            {["ALL", "ACTIVE", "INACTIVE"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === st
                    ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {st === "ALL" ? "All" : st === "ACTIVE" ? "Active" : "Inactive"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => loadDepartments()}>
            Retry
          </Button>
        </div>
      )}

      {/* Departments Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : departments.length === 0 ? (
          <EmptyState
            title="No departments found"
            description="Create organizational departments like Sales, Engineering, Finance, or Operations."
            icon={<Network className="w-8 h-8 text-slate-400" />}
            actionLabel="Add Department"
            onAction={openCreateModal}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Department</th>
                  <th className="py-3.5 px-6">Branch Office</th>
                  <th className="py-3.5 px-6">Department Head / Manager</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {departments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                          <Network className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-900">{dept.name}</span>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            ID: {dept.id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <GitFork className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium">
                          {dept.branch?.name
                            ? `${dept.branch.name} (${dept.branch.code})`
                            : getBranchLabel(dept.branchId)}
                        </span>
                      </div>
                    </td>

                    <td className="py-4 px-6 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {dept.manager?.fullName || getManagerLabel(dept.managerUserId)}
                        </span>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <StatusBadge status={dept.status} />
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(dept)}
                          className="h-8 px-2.5 text-xs text-slate-700 bg-white hover:bg-slate-50 border-slate-200"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1" />
                          <span>Edit</span>
                        </Button>

                        {/* Status Toggle (No Delete) */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setStatusChangeTarget(dept)}
                          className={`h-8 px-2.5 text-xs border ${
                            dept.status === "ACTIVE"
                              ? "text-rose-700 border-rose-200 hover:bg-rose-50"
                              : "text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                          }`}
                          title={dept.status === "ACTIVE" ? "Deactivate department" : "Activate department"}
                        >
                          {dept.status === "ACTIVE" ? (
                            <>
                              <PowerOff className="w-3.5 h-3.5 mr-1" />
                              <span>Deactivate</span>
                            </>
                          ) : (
                            <>
                              <Power className="w-3.5 h-3.5 mr-1" />
                              <span>Activate</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Department Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDept ? "Edit Department" : "Create New Department"}
        description="Link departmental unit to a regional branch and assign a leadership manager."
        maxWidth="md"
      >
        <form onSubmit={handleSaveDepartment} className="space-y-4">
          {modalError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-800">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <Input
            label="Department Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Enterprise Sales, Human Resources, Finance"
          />

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Associated Branch Office
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              <option value="">All Locations / Central Head Office</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Optional: Restrict department operations to a specific branch.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Department Manager / Lead
            </label>
            <select
              value={managerUserId}
              onChange={(e) => setManagerUserId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              <option value="">Unassigned (No manager specified)</option>
              {staffUsers.map((u) => {
                const uid = u.userId || (u as unknown as { id: string }).id;
                return (
                  <option key={uid} value={uid}>
                    {u.fullName} ({u.email}) {u.roleName ? `• ${u.roleName}` : ""}
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Select team member responsible for approvals and task oversight.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2 rounded-xl"
            >
              {isSaving ? "Saving..." : editingDept ? "Update Department" : "Create Department"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Status Toggle Dialog (No Delete) */}
      <ConfirmDialog
        isOpen={Boolean(statusChangeTarget)}
        onClose={() => setStatusChangeTarget(null)}
        onConfirm={handleToggleStatus}
        title={
          statusChangeTarget?.status === "ACTIVE"
            ? "Deactivate Department?"
            : "Activate Department?"
        }
        description={
          statusChangeTarget?.status === "ACTIVE"
            ? `Are you sure you want to set "${statusChangeTarget?.name}" to INACTIVE? Departments cannot be deleted, but inactive departments will not accept new team assignments.`
            : `Are you sure you want to reactivate "${statusChangeTarget?.name}"?`
        }
        confirmLabel={
          statusChangeTarget?.status === "ACTIVE" ? "Deactivate Department" : "Activate Department"
        }
        variant={statusChangeTarget?.status === "ACTIVE" ? "danger" : "primary"}
        isLoading={isUpdatingStatus}
      />
    </div>
  );
}

export default function DepartmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-4">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      }
    >
      <DepartmentsContent />
    </Suspense>
  );
}
