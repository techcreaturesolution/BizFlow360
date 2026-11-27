"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import {
  Users2,
  Plus,
  Search,
  Network,
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
  FolderTree,
  List,
  ChevronRight,
  ChevronDown,
  UserPlus,
  Check,
} from "lucide-react";

import {
  getTeamsList,
  createTeam,
  updateTeam,
  getDepartments,
  getUsersList,
} from "@/lib/tenant";
import {
  TeamItem,
  CreateTeamInput,
  DepartmentItem,
  StaffUserItem,
} from "@/types/tenant";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/ErrorState";
import { JsonViewer } from "@/components/ui/JsonViewer";

type ViewMode = "list" | "tree";

function TeamsContent() {
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUserItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // View Mode: List vs Hierarchy Tree
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Modal Form Inputs
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [parentTeamId, setParentTeamId] = useState<string>("");
  const [managerUserId, setManagerUserId] = useState<string>("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  // Toggle Status Confirm Dialog
  const [statusChangeTarget, setStatusChangeTarget] = useState<TeamItem | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [showRawJson, setShowRawJson] = useState(false);

  // Load auxiliary data: departments and staff users
  useEffect(() => {
    getDepartments().then((d) => setDepartments(d)).catch(() => {});
    getUsersList().then((u) => setStaffUsers(u)).catch(() => {});
  }, []);

  const loadTeams = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMsg(null);

    try {
      const data = await getTeamsList({
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        departmentId: departmentFilter !== "ALL" ? departmentFilter : undefined,
        search: searchQuery.trim() || undefined,
      });
      setTeams(data);
    } catch (err: unknown) {
      console.warn("Failed to load teams:", err);
      setErrorMsg("Failed to load company teams. Please check your connection.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter, departmentFilter, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTeams();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadTeams]);

  const openCreateModal = () => {
    setEditingTeam(null);
    setName("");
    setDescription("");
    setDepartmentId(departments[0]?.id || "");
    setParentTeamId("");
    setManagerUserId("");
    setSelectedMemberIds([]);
    setStatus("ACTIVE");
    setMemberSearchQuery("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (team: TeamItem) => {
    setEditingTeam(team);
    setName(team.name || "");
    setDescription(team.description || "");
    setDepartmentId(team.departmentId || "");
    setParentTeamId(team.parentTeamId || "");
    setManagerUserId(team.managerUserId || "");

    // Extract all assigned members to guarantee FULL mapping is sent on PUT
    const existingIds =
      team.memberIds && team.memberIds.length > 0
        ? team.memberIds
        : team.members?.map((m) => m.userId || (m as unknown as { id: string }).id) || [];
    setSelectedMemberIds(existingIds.filter(Boolean));

    setStatus((team.status as "ACTIVE" | "INACTIVE") || "ACTIVE");
    setMemberSearchQuery("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleToggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!name.trim()) {
      setModalError("Team Name is required.");
      return;
    }

    setIsSaving(true);
    try {
      // Rule: memberIds REPLACES the mapping on PUT, so always send the full member list
      const payload: CreateTeamInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        departmentId: departmentId.trim() ? departmentId.trim() : null,
        parentTeamId: parentTeamId.trim() ? parentTeamId.trim() : null,
        managerUserId: managerUserId.trim() ? managerUserId.trim() : null,
        memberIds: selectedMemberIds,
        status,
      };

      if (editingTeam) {
        await updateTeam(editingTeam.id, payload);
      } else {
        await createTeam(payload);
      }

      setIsModalOpen(false);
      await loadTeams(true);
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { message?: string; error?: string } };
      };
      const message =
        errorObj?.response?.data?.message ||
        errorObj?.response?.data?.error ||
        "Failed to save team. Please check inputs.";
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
      const existingMembers =
        statusChangeTarget.memberIds ||
        statusChangeTarget.members?.map((m) => m.userId) ||
        [];

      await updateTeam(statusChangeTarget.id, {
        name: statusChangeTarget.name,
        departmentId: statusChangeTarget.departmentId,
        parentTeamId: statusChangeTarget.parentTeamId,
        managerUserId: statusChangeTarget.managerUserId,
        memberIds: existingMembers,
        status: nextStatus,
      });
      setStatusChangeTarget(null);
      await loadTeams(true);
    } catch (err: unknown) {
      console.warn("Failed to update team status:", err);
      alert("Unable to change team status. Please try again.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getDepartmentLabel = (id?: string | null) => {
    if (!id) return "General / Cross-functional";
    const d = departments.find((dept) => dept.id === id);
    return d ? d.name : "Department";
  };

  const getParentTeamLabel = (id?: string | null) => {
    if (!id) return "Top-level Team";
    const t = teams.find((item) => item.id === id);
    return t ? t.name : "Parent Team";
  };

  const getManagerLabel = (id?: string | null) => {
    if (!id) return "Unassigned";
    const u = staffUsers.find((user) => user.userId === id || (user as unknown as { id: string }).id === id);
    return u ? u.fullName : "Team Lead";
  };

  // Build tree structure for Hierarchy Tree View
  const teamTree = useMemo(() => {
    const rootTeams = teams.filter((t) => !t.parentTeamId);
    const getChildren = (parentId: string): TeamItem[] => {
      return teams.filter((t) => t.parentTeamId === parentId);
    };
    return { rootTeams, getChildren };
  }, [teams]);

  const filteredStaffUsers = useMemo(() => {
    if (!memberSearchQuery.trim()) return staffUsers;
    const q = memberSearchQuery.toLowerCase();
    return staffUsers.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.roleName?.toLowerCase().includes(q)
    );
  }, [staffUsers, memberSearchQuery]);

  return (
    <div className="space-y-6 pb-16">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Teams & Hierarchy
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Users2 className="w-3 h-3" /> Team Structure
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Organize functional squads, reporting hierarchies, and team member assignments.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* List vs Tree View Toggle */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                viewMode === "list"
                  ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("tree")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                viewMode === "tree"
                  ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Hierarchy Tree</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTeams(true)}
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
            <span>Add Team</span>
          </Button>
        </div>
      </div>

      {/* Dev Mode Inspector */}
      {showRawJson && (
        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white overflow-hidden shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              Dev Mode Inspector: GET /api/v1/teams
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Total: {teams.length}
            </span>
          </div>
          <JsonViewer data={teams} defaultExpanded={true} />
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
              placeholder="Search teams by name..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="w-full sm:w-56 px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
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
          <Button size="sm" variant="outline" onClick={() => loadTeams()}>
            Retry
          </Button>
        </div>
      )}

      {/* Main View Area */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-3 shadow-xs">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : teams.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <EmptyState
            title="No teams configured"
            description="Create project squads, operational teams, or regional task forces."
            icon={<Users2 className="w-8 h-8 text-slate-400" />}
            actionLabel="Add Team"
            onAction={openCreateModal}
          />
        </div>
      ) : viewMode === "list" ? (
        /* LIST VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Team</th>
                  <th className="py-3.5 px-6">Department</th>
                  <th className="py-3.5 px-6">Parent Team</th>
                  <th className="py-3.5 px-6">Team Lead</th>
                  <th className="py-3.5 px-6">Members</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {teams.map((t) => {
                  const memberCount =
                    t.memberIds?.length || t.members?.length || 0;

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 text-purple-600">
                            <Users2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900">{t.name}</span>
                            {t.description && (
                              <p className="text-[11px] text-slate-500 font-normal mt-0.5 line-clamp-1 max-w-xs">
                                {t.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Network className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t.department?.name || getDepartmentLabel(t.departmentId)}</span>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-slate-600">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                            t.parentTeamId
                              ? "bg-slate-100 text-slate-800"
                              : "text-slate-400 italic"
                          }`}
                        >
                          {t.parentTeam?.name || getParentTeamLabel(t.parentTeamId)}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t.manager?.fullName || getManagerLabel(t.managerUserId)}</span>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <Users className="w-3 h-3 text-slate-400" />
                          {memberCount} Members
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <StatusBadge status={t.status} />
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(t)}
                            className="h-8 px-2.5 text-xs text-slate-700 bg-white hover:bg-slate-50 border-slate-200"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1" />
                            <span>Edit</span>
                          </Button>

                          {/* Status Toggle (No Delete) */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setStatusChangeTarget(t)}
                            className={`h-8 px-2.5 text-xs border ${
                              t.status === "ACTIVE"
                                ? "text-rose-700 border-rose-200 hover:bg-rose-50"
                                : "text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                            }`}
                            title={t.status === "ACTIVE" ? "Deactivate team" : "Activate team"}
                          >
                            {t.status === "ACTIVE" ? (
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* HIERARCHY TREE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-indigo-600" />
              Organizational Team Hierarchy Tree
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualizes parent teams, child functional squads, and mapped staff counts.
            </p>
          </div>

          <div className="space-y-3">
            {teamTree.rootTeams.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No root teams found.</p>
            ) : (
              teamTree.rootTeams.map((root) => (
                <TreeNode
                  key={root.id}
                  team={root}
                  getChildren={teamTree.getChildren}
                  onEdit={openEditModal}
                  onToggleStatus={(target) => setStatusChangeTarget(target)}
                  getDepartmentLabel={getDepartmentLabel}
                  getManagerLabel={getManagerLabel}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Team Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTeam ? "Edit Team Hierarchy & Members" : "Create New Team"}
        description="Establish team reporting structure, assign department, and manage mapped staff members."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveTeam} className="space-y-4">
          {modalError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-800">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Team Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. West India Sales Squad, Backend Core"
              />
            </div>

            <div className="sm:col-span-2">
              <Input
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Handles client accounts and enterprise outreach in Maharashtra"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Department
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              >
                <option value="">Cross-functional / No Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Parent Team (Reporting Hierarchy)
              </label>
              <select
                value={parentTeamId}
                onChange={(e) => setParentTeamId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              >
                <option value="">None (Top-level Root Team)</option>
                {teams
                  .filter((t) => t.id !== editingTeam?.id) // Prevent self-referencing hierarchy loop
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Team Lead / Manager
              </label>
              <select
                value={managerUserId}
                onChange={(e) => setManagerUserId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              >
                <option value="">Unassigned</option>
                {staffUsers.map((u) => {
                  const uid = u.userId || (u as unknown as { id: string }).id;
                  return (
                    <option key={uid} value={uid}>
                      {u.fullName} ({u.email}) {u.roleName ? `• ${u.roleName}` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Member Selection Checklist */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Assigned Team Members ({selectedMemberIds.length} selected)
              </label>
              <span className="text-[11px] text-indigo-600 font-medium">
                Note: Updating replaces member mapping
              </span>
            </div>

            {/* Member search inside modal */}
            <div className="relative mb-2.5">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                placeholder="Filter staff members to assign..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 p-1">
              {filteredStaffUsers.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No staff members match the filter.
                </div>
              ) : (
                filteredStaffUsers.map((user) => {
                  const uid = user.userId || (user as unknown as { id: string }).id;
                  const isChecked = selectedMemberIds.includes(uid);
                  return (
                    <label
                      key={uid}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleMember(uid)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">{user.fullName}</p>
                          <p className="text-[10px] text-slate-500">
                            {user.email} {user.roleName ? `• ${user.roleName}` : ""}
                          </p>
                        </div>
                      </div>
                      {isChecked && (
                        <span className="text-[10px] font-bold text-indigo-600 px-1.5 py-0.5 rounded bg-indigo-50">
                          Assigned
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
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
              {isSaving ? "Saving..." : editingTeam ? "Update Team" : "Create Team"}
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
            ? "Deactivate Team?"
            : "Activate Team?"
        }
        description={
          statusChangeTarget?.status === "ACTIVE"
            ? `Are you sure you want to set "${statusChangeTarget?.name}" to INACTIVE? Teams cannot be deleted, but inactive teams will be hidden from new task assignments.`
            : `Are you sure you want to reactivate "${statusChangeTarget?.name}"?`
        }
        confirmLabel={
          statusChangeTarget?.status === "ACTIVE" ? "Deactivate Team" : "Activate Team"
        }
        variant={statusChangeTarget?.status === "ACTIVE" ? "danger" : "primary"}
        isLoading={isUpdatingStatus}
      />
    </div>
  );
}

interface TreeNodeProps {
  team: TeamItem;
  getChildren: (parentId: string) => TeamItem[];
  onEdit: (team: TeamItem) => void;
  onToggleStatus: (team: TeamItem) => void;
  getDepartmentLabel: (id?: string | null) => string;
  getManagerLabel: (id?: string | null) => string;
  level?: number;
}

function TreeNode({
  team,
  getChildren,
  onEdit,
  onToggleStatus,
  getDepartmentLabel,
  getManagerLabel,
  level = 0,
}: TreeNodeProps) {
  const children = getChildren(team.id);
  const [isExpanded, setIsExpanded] = useState(true);
  const memberCount = team.memberIds?.length || team.members?.length || 0;

  return (
    <div className={`space-y-2 ${level > 0 ? "ml-6 pl-4 border-l-2 border-indigo-100" : ""}`}>
      <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 transition-all shadow-2xs">
        <div className="flex items-center gap-3">
          {children.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <div className="w-6 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">{team.name}</span>
              <StatusBadge status={team.status} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1">
              <span>Dept: {team.department?.name || getDepartmentLabel(team.departmentId)}</span>
              <span>•</span>
              <span>Lead: {team.manager?.fullName || getManagerLabel(team.managerUserId)}</span>
              <span>•</span>
              <span>{memberCount} Members</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(team)}
            className="h-7 px-2 text-xs text-slate-700 bg-white hover:bg-slate-50 border-slate-200"
          >
            <Edit2 className="w-3 h-3 mr-1" />
            <span>Edit</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleStatus(team)}
            className={`h-7 px-2 text-xs border ${
              team.status === "ACTIVE"
                ? "text-rose-700 border-rose-200 hover:bg-rose-50"
                : "text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            }`}
          >
            {team.status === "ACTIVE" ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </div>

      {isExpanded && children.length > 0 && (
        <div className="space-y-2">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              team={child}
              getChildren={getChildren}
              onEdit={onEdit}
              onToggleStatus={onToggleStatus}
              getDepartmentLabel={getDepartmentLabel}
              getManagerLabel={getManagerLabel}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeamsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-4">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      }
    >
      <TeamsContent />
    </Suspense>
  );
}
