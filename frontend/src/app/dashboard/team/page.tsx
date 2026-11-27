"use client";

import React, { useState, useEffect, useCallback, Suspense, useRef } from "react";
import {
  Users,
  UserPlus,
  Search,
  Building,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  AlertCircle,
  PowerOff,
  Power,
  RefreshCw,
  GitFork,
  Network,
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Shield,
  Crown,
} from "lucide-react";

import {
  getTeamMembers,
  updateUserStatus,
  inviteTeamMember,
  getBranches,
  getDepartments,
  getRolesAndPermissions,
} from "@/lib/tenant";
import { getUser } from "@/lib/storage";
import {
  TeamMember,
  TeamMembersPagination,
  BranchItem,
  DepartmentItem,
  RoleItem,
  InvitationData,
} from "@/types/tenant";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/ErrorState";
import { JsonViewer } from "@/components/ui/JsonViewer";

function TeamManagementContent() {
  const currentUser = getUser();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pagination, setPagination] = useState<TeamMembersPagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  // Debounced Search Reference
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviteBranchId, setInviteBranchId] = useState("");
  const [inviteDepartmentId, setInviteDepartmentId] = useState("");
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Success Invitation Dialog State
  const [successfulInvitation, setSuccessfulInvitation] = useState<InvitationData | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Status Change Dialog
  const [statusTarget, setStatusTarget] = useState<TeamMember | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [showRawJson, setShowRawJson] = useState(false);

  // Load auxiliary data on mount: branches, departments, roles
  useEffect(() => {
    getBranches().then((b) => setBranches(b)).catch(() => {});
    getDepartments().then((d) => setDepartments(d)).catch(() => {});
    getRolesAndPermissions()
      .then((data) => setRoles(data.roles))
      .catch(() => {});
  }, []);

  const loadMembers = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setIsLoading(true);
      else setIsRefreshing(true);
      setErrorMsg(null);

      try {
        const res = await getTeamMembers({
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          branch: branchFilter !== "ALL" ? branchFilter : undefined,
          department: departmentFilter !== "ALL" ? departmentFilter : undefined,
          search: searchQuery.trim() || undefined,
          page,
          limit,
        });

        setMembers(res.members);
        setPagination(res.pagination);
      } catch (err: unknown) {
        console.warn("Failed to load team members:", err);
        setErrorMsg("Failed to load team roster. Please check your network connection.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [statusFilter, branchFilter, departmentFilter, searchQuery, page, limit]
  );

  // Search input change with 400ms debounce
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      loadMembers();
    }, 400);
  };

  useEffect(() => {
    loadMembers();
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [loadMembers]);

  // Handle Invite Submission
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);

    if (!inviteFullName.trim() || !inviteEmail.trim()) {
      setInviteError("Full Name and a valid Email Address are required.");
      return;
    }

    setIsSubmittingInvite(true);
    try {
      // Find selected branch & department to send code or ID exactly as documented
      const selBranch = branches.find((b) => b.id === inviteBranchId);
      const selDept = departments.find((d) => d.id === inviteDepartmentId);

      const branchVal = selBranch ? selBranch.code || selBranch.id : inviteBranchId || null;
      const deptVal = selDept ? selDept.name || selDept.id : inviteDepartmentId || null;

      const res = await inviteTeamMember({
        fullName: inviteFullName.trim(),
        email: inviteEmail.trim().toLowerCase(),
        roleId: inviteRoleId.trim() || null,
        branchId: branchVal,
        departmentId: deptVal,
      });

      setIsInviteModalOpen(false);
      setSuccessfulInvitation(res.invitation);
      await loadMembers(true);
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { status?: number; data?: { message?: string; error?: string } };
      };
      const statusCode = errorObj?.response?.status;
      const message =
        errorObj?.response?.data?.message ||
        errorObj?.response?.data?.error ||
        "Failed to send invitation. Please try again.";

      if (statusCode === 403) {
        setInviteError(
          message.toLowerCase().includes("seat")
            ? "Workspace seat limit reached! Please upgrade your subscription to add more members."
            : "Permission Denied: You do not have privilege to invite team members."
        );
      } else if (statusCode === 409) {
        setInviteError("This user is already an active member of your company workspace.");
      } else {
        setInviteError(message);
      }
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  // Handle Status Toggle (Activate / Deactivate)
  const handleToggleStatus = async () => {
    if (!statusTarget) return;
    setIsUpdatingStatus(true);
    try {
      const nextStatus = statusTarget.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await updateUserStatus(statusTarget.userId, nextStatus);
      setStatusTarget(null);
      await loadMembers(true);
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { status?: number; data?: { message?: string; error?: string } };
      };
      const statusCode = errorObj?.response?.status;
      const message =
        errorObj?.response?.data?.message ||
        errorObj?.response?.data?.error ||
        "Unable to modify user status.";

      if (statusCode === 400) {
        alert("Action Denied: You cannot deactivate your own logged-in account.");
      } else if (statusCode === 403) {
        alert("Action Denied: The Company Owner account cannot be deactivated.");
      } else {
        alert(message);
      }
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const copyInviteLink = () => {
    if (successfulInvitation?.inviteLink) {
      navigator.clipboard.writeText(successfulInvitation.inviteLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const isOwnerRow = (member: TeamMember) => {
    const rolesArr = member.roles || [];
    return (
      rolesArr.some((r) => r.toUpperCase() === "OWNER") ||
      member.roleName?.toUpperCase() === "OWNER"
    );
  };

  const isCurrentLoggedInUser = (member: TeamMember) => {
    if (!currentUser) return false;
    return (
      (currentUser.id && member.userId === currentUser.id) ||
      (currentUser.email && member.email.toLowerCase() === currentUser.email.toLowerCase())
    );
  };

  const getBranchName = (branchId?: string | null) => {
    if (!branchId) return "All Locations";
    const b = branches.find((item) => item.id === branchId || item.code === branchId);
    return b ? `${b.name} (${b.code})` : branchId;
  };

  const getDepartmentName = (deptId?: string | null) => {
    if (!deptId) return "Cross-Functional";
    const d = departments.find((item) => item.id === deptId || item.name === deptId);
    return d ? d.name : deptId;
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Team Members & Roster
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Users className="w-3 h-3" /> Directory
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage employee accounts, invitations, assigned branches, and operational access.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadMembers(true)}
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
            onClick={() => {
              setInviteFullName("");
              setInviteEmail("");
              setInviteRoleId("");
              setInviteBranchId("");
              setInviteDepartmentId("");
              setInviteError(null);
              setIsInviteModalOpen(true);
            }}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Member</span>
          </Button>
        </div>
      </div>

      {/* Dev Mode Raw JSON Inspector */}
      {showRawJson && (
        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white overflow-hidden shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              Dev Mode Inspector: GET /api/v1/users
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Total Count: {pagination.total} members
            </span>
          </div>
          <JsonViewer data={{ members, pagination }} defaultExpanded={true} />
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Debounced Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name, email..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="INVITED">Invited</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          {/* Branch Filter */}
          <select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => {
              setDepartmentFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
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

      {/* Error state */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => loadMembers()}>
            Retry
          </Button>
        </div>
      )}

      {/* Team Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            title="No team members found"
            description="Invite colleagues or adjust your active status and branch filters."
            icon={<Users className="w-8 h-8 text-slate-400" />}
            actionLabel="Invite Member"
            onAction={() => setIsInviteModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Member</th>
                  <th className="py-3.5 px-6">Role</th>
                  <th className="py-3.5 px-6">Location & Dept</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Joined / Created</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {members.map((member) => {
                  const isOwner = isOwnerRow(member);
                  const isSelf = isCurrentLoggedInUser(member);
                  const isDisableActionRestricted = isOwner || isSelf;

                  return (
                    <tr
                      key={member.userId || member.membershipId || member.email}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Member Info */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {member.fullName?.charAt(0)?.toUpperCase() || "U"}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">
                                {member.fullName}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700">
                                  You
                                </span>
                              )}
                              {isOwner && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700">
                                  <Crown className="w-2.5 h-2.5" /> Owner
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                              <span>{member.email}</span>
                              {member.phone && <span>• {member.phone}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          <Shield className="w-3 h-3 text-slate-500" />
                          <span>{member.roleName || member.roles?.[0] || "Member"}</span>
                        </span>
                      </td>

                      {/* Location & Dept */}
                      <td className="py-4 px-6 text-slate-600 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <GitFork className="w-3 h-3 text-slate-400" />
                          <span>{getBranchName(member.branchId)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Network className="w-3 h-3 text-slate-400" />
                          <span>{getDepartmentName(member.departmentId)}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <StatusBadge status={member.status} />
                      </td>

                      {/* Joined / Created */}
                      <td className="py-4 px-6 text-slate-500 font-medium">
                        {member.joinedAt || member.createdAt
                          ? new Date(member.joinedAt || member.createdAt!).toLocaleDateString(
                              undefined,
                              { dateStyle: "medium" }
                            )
                          : "—"}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        {isDisableActionRestricted ? (
                          <span
                            className="text-[11px] text-slate-400 italic cursor-not-allowed"
                            title={
                              isOwner
                                ? "Owner account cannot be modified"
                                : "You cannot deactivate your own account"
                            }
                          >
                            Protected
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setStatusTarget(member)}
                            className={`h-8 px-2.5 text-xs border ${
                              member.status === "ACTIVE"
                                ? "text-rose-700 border-rose-200 hover:bg-rose-50"
                                : "text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                            }`}
                          >
                            {member.status === "ACTIVE" ? (
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
                        )}
                      </td>
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
              Showing <span className="font-semibold text-slate-800">{members.length}</span> of{" "}
              <span className="font-semibold text-slate-800">{pagination.total}</span> team members
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

      {/* Invite Member Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite New Team Member"
        description="Generate an invitation link for a new staff member to join your workspace."
        maxWidth="md"
      >
        <form onSubmit={handleInviteSubmit} className="space-y-4">
          {inviteError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{inviteError}</span>
            </div>
          )}

          <Input
            label="Full Name"
            required
            value={inviteFullName}
            onChange={(e) => setInviteFullName(e.target.value)}
            placeholder="e.g. Rahul Sharma"
          />

          <Input
            label="Work Email Address"
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="rahul@company.com"
            helperText="The user will receive account credentials or an invite confirmation."
          />

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Role & Permissions
            </label>
            <select
              value={inviteRoleId}
              onChange={(e) => setInviteRoleId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              <option value="">Default Member (Standard Workspace Access)</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.isSystem ? "(System)" : "(Custom)"}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Branch Location
              </label>
              <select
                value={inviteBranchId}
                onChange={(e) => setInviteBranchId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              >
                <option value="">All Branches / Central</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.code || b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Department
              </label>
              <select
                value={inviteDepartmentId}
                onChange={(e) => setInviteDepartmentId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name || d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsInviteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmittingInvite}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2 rounded-xl"
            >
              {isSubmittingInvite ? "Generating Invite..." : "Send Invitation"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Successful Invitation Link Dialog */}
      <Modal
        isOpen={Boolean(successfulInvitation)}
        onClose={() => setSuccessfulInvitation(null)}
        title="Invitation Created Successfully"
        description="Share this secure one-time invitation link with the employee to activate their account."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-800">
              <p className="font-bold text-emerald-900">
                Invitation Generated for {successfulInvitation?.fullName}
              </p>
              <p className="mt-0.5">
                Email: <span className="font-mono">{successfulInvitation?.email}</span>
              </p>
              {successfulInvitation?.expiresAt && (
                <p className="mt-0.5 text-emerald-700">
                  Expires: {new Date(successfulInvitation.expiresAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {successfulInvitation?.inviteLink && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Secure Invitation URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={successfulInvitation.inviteLink}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none"
                />
                <Button
                  size="sm"
                  onClick={copyInviteLink}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-2 rounded-xl shrink-0 gap-1.5"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button
              size="sm"
              onClick={() => setSuccessfulInvitation(null)}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-5 py-2 rounded-xl"
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Deactivation / Activation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={handleToggleStatus}
        title={
          statusTarget?.status === "ACTIVE"
            ? "Deactivate Team Member?"
            : "Activate Team Member?"
        }
        description={
          statusTarget?.status === "ACTIVE"
            ? `Are you sure you want to deactivate "${statusTarget?.fullName}"? They will lose login access to the workspace immediately.`
            : `Are you sure you want to reactivate "${statusTarget?.fullName}"? Their account login privileges will be restored.`
        }
        confirmLabel={
          statusTarget?.status === "ACTIVE" ? "Deactivate User" : "Activate User"
        }
        variant={statusTarget?.status === "ACTIVE" ? "danger" : "primary"}
        isLoading={isUpdatingStatus}
      />
    </div>
  );
}

export default function TeamManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-4">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      }
    >
      <TeamManagementContent />
    </Suspense>
  );
}
