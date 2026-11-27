"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import {
  ShieldCheck,
  Shield,
  Plus,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCcw,
  RefreshCw,
  Search,
  Check,
  Layers,
  Sparkles,
  Info,
  ShieldAlert,
} from "lucide-react";

import {
  getRolesAndPermissions,
  createCustomRole,
  updateRolePermissions,
} from "@/lib/tenant";
import {
  RoleItem,
  RolePermissionItem,
} from "@/types/tenant";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/ErrorState";
import { JsonViewer } from "@/components/ui/JsonViewer";

function RolesManagementContent() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<RolePermissionItem[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected role permissions state for unsaved-changes tracking
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [savedPermissions, setSavedPermissions] = useState<string[]>([]);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Filter for permissions search
  const [permissionFilter, setPermissionFilter] = useState("");

  // Create Role Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [createRoleError, setCreateRoleError] = useState<string | null>(null);

  const [showRawJson, setShowRawJson] = useState(false);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMsg(null);

    try {
      const res = await getRolesAndPermissions();
      setRoles(res.roles);
      setAvailablePermissions(res.availablePermissions);

      // Select first role if none selected or selected role was deleted/missing
      if (res.roles.length > 0) {
        const target = res.roles.find((r) => r.id === selectedRoleId) || res.roles[0];
        setSelectedRoleId(target.id);
        const perms = target.permissions || [];
        setSelectedPermissions(perms);
        setSavedPermissions(perms);
      }
    } catch (err: unknown) {
      console.warn("Failed to load roles and permissions:", err);
      setErrorMsg("Failed to load roles and permission catalog. Please check network connection.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedRoleId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeRole = useMemo(() => {
    return roles.find((r) => r.id === selectedRoleId) || null;
  }, [roles, selectedRoleId]);

  const isSystemRole = useMemo(() => {
    if (!activeRole) return false;
    const sysNames = ["OWNER", "ADMIN", "MEMBER", "SUPER_ADMIN"];
    return Boolean(activeRole.isSystem) || sysNames.includes(activeRole.name.toUpperCase());
  }, [activeRole]);

  // When switching selected role, update local permission sets
  const handleSelectRole = (role: RoleItem) => {
    if (hasUnsavedChanges) {
      const confirmDiscard = window.confirm(
        "You have unsaved permission changes for this role. Are you sure you want to switch and discard them?"
      );
      if (!confirmDiscard) return;
    }

    setSelectedRoleId(role.id);
    const perms = role.permissions || [];
    setSelectedPermissions(perms);
    setSavedPermissions(perms);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);
  };

  // Group available permissions by moduleCode
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, RolePermissionItem[]> = {};

    availablePermissions.forEach((p) => {
      const mod = p.moduleCode || "GENERAL";
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(p);
    });

    return groups;
  }, [availablePermissions]);

  // Track unsaved modifications
  const hasUnsavedChanges = useMemo(() => {
    if (isSystemRole) return false;
    if (selectedPermissions.length !== savedPermissions.length) return true;
    const setA = new Set(selectedPermissions);
    for (const code of savedPermissions) {
      if (!setA.has(code)) return true;
    }
    return false;
  }, [selectedPermissions, savedPermissions, isSystemRole]);

  const handleTogglePermission = (code: string) => {
    if (isSystemRole) return;
    setSelectedPermissions((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleToggleModuleAll = (moduleCode: string, selectAll: boolean) => {
    if (isSystemRole) return;
    const modulePerms = (groupedPermissions[moduleCode] || []).map((p) => p.code);
    if (selectAll) {
      const combined = Array.from(new Set([...selectedPermissions, ...modulePerms]));
      setSelectedPermissions(combined);
    } else {
      setSelectedPermissions((prev) => prev.filter((code) => !modulePerms.includes(code)));
    }
  };

  const handleDiscardChanges = () => {
    setSelectedPermissions(savedPermissions);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);
  };

  const handleSavePermissions = async () => {
    if (!activeRole || isSystemRole) return;
    setIsSavingPermissions(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    try {
      await updateRolePermissions(activeRole.id, selectedPermissions);

      // Update in local roles state
      setRoles((prev) =>
        prev.map((r) =>
          r.id === activeRole.id ? { ...r, permissions: selectedPermissions } : r
        )
      );
      setSavedPermissions(selectedPermissions);
      setSaveSuccessMsg(`Permissions updated for role "${activeRole.name}" successfully.`);
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { message?: string; error?: string } };
      };
      const msg =
        errorObj?.response?.data?.message ||
        errorObj?.response?.data?.error ||
        "Failed to save role permissions.";
      setSaveErrorMsg(msg);
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateRoleError(null);

    if (!newRoleName.trim()) {
      setCreateRoleError("Role Name is required.");
      return;
    }

    setIsCreatingRole(true);
    try {
      const formattedName = newRoleName.trim().toUpperCase().replace(/\s+/g, "_");
      const created = await createCustomRole({
        name: formattedName,
        description: newRoleDesc.trim() || undefined,
      });

      setIsCreateModalOpen(false);
      setRoles((prev) => [...prev, created]);
      setSelectedRoleId(created.id);
      setSelectedPermissions(created.permissions || []);
      setSavedPermissions(created.permissions || []);
      setSaveSuccessMsg(`Custom role "${created.name}" created. You can now configure permissions.`);
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { status?: number; data?: { message?: string; error?: string } };
      };
      const statusCode = errorObj?.response?.status;
      const msg =
        errorObj?.response?.data?.message ||
        errorObj?.response?.data?.error ||
        "Failed to create role.";

      if (statusCode === 409 || msg.toLowerCase().includes("already exists")) {
        setCreateRoleError("A role with this name already exists in your workspace.");
      } else {
        setCreateRoleError(msg);
      }
    } finally {
      setIsCreatingRole(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Roles & Permissions (RBAC)
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <ShieldCheck className="w-3 h-3" /> Access Governance
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Define security roles, configure granular functional permissions, and enforce access boundaries.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
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
              setNewRoleName("");
              setNewRoleDesc("");
              setCreateRoleError(null);
              setIsCreateModalOpen(true);
            }}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Role</span>
          </Button>
        </div>
      </div>

      {/* Dev Mode Raw JSON Inspector */}
      {showRawJson && (
        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white overflow-hidden shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              Dev Mode Inspector: GET /api/v1/roles
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Roles: {roles.length} | Available Permissions: {availablePermissions.length}
            </span>
          </div>
          <JsonViewer data={{ roles, availablePermissions }} defaultExpanded={true} />
        </div>
      )}

      {/* Error state */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => loadData()}>
            Retry
          </Button>
        </div>
      )}

      {/* Main 2-Column Layout */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-3">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-8">
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Role Cards Roster */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Workspace Roles ({roles.length})
              </span>
            </div>

            <div className="space-y-2.5">
              {roles.map((role) => {
                const isSelected = role.id === selectedRoleId;
                const isSys =
                  Boolean(role.isSystem) ||
                  ["OWNER", "ADMIN", "MEMBER"].includes(role.name.toUpperCase());
                const permCount = role.permissions?.length || 0;

                return (
                  <div
                    key={role.id}
                    onClick={() => handleSelectRole(role)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") handleSelectRole(role);
                    }}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? "bg-white border-indigo-600 shadow-sm ring-2 ring-indigo-500/20"
                        : "bg-white/80 border-slate-200/80 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={`p-2 rounded-xl ${
                            isSys
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          }`}
                        >
                          <Shield className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{role.name}</h3>
                          {isSys ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700">
                              <Lock className="w-2.5 h-2.5" /> System Predefined
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600">
                              <Unlock className="w-2.5 h-2.5" /> Custom Role
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {isSys && role.name.toUpperCase() === "OWNER"
                          ? "All Permissions"
                          : `${permCount} grants`}
                      </span>
                    </div>

                    {role.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-2 leading-relaxed">
                        {role.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Permission Matrix Detail Panel */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
            {activeRole ? (
              <>
                {/* Role Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-900">{activeRole.name}</h2>
                      {isSystemRole ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          <Lock className="w-3 h-3" /> System Role (Protected)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="w-3 h-3" /> Editable Permissions
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {activeRole.description || "Custom access boundary configured for workspace."}
                    </p>
                  </div>

                  <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 shrink-0 self-start sm:self-auto">
                    {isSystemRole && activeRole.name.toUpperCase() === "OWNER"
                      ? "Full Unlimited Access"
                      : `${selectedPermissions.length} Active Grants`}
                  </span>
                </div>

                {/* System Predefined Role Notice */}
                {isSystemRole && (
                  <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 flex items-start gap-3">
                    <Lock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-purple-900">
                      <p className="font-bold">System Predefined Role (Read-Only)</p>
                      <p className="mt-0.5 text-purple-800">
                        Predefined platform security roles cannot be modified to prevent authorization escalation. To customize permissions, create a custom role using the &quot;Create Role&quot; button.
                      </p>
                    </div>
                  </div>
                )}

                {/* Notifications */}
                {saveSuccessMsg && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{saveSuccessMsg}</span>
                  </div>
                )}

                {saveErrorMsg && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-800">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{saveErrorMsg}</span>
                  </div>
                )}

                {/* Permission Filter Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={permissionFilter}
                    onChange={(e) => setPermissionFilter(e.target.value)}
                    placeholder="Filter permissions by code or module name..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* Grouped Permission Matrix */}
                <div className="space-y-5">
                  {Object.entries(groupedPermissions).map(([moduleCode, perms]) => {
                    const filtered = perms.filter(
                      (p) =>
                        !permissionFilter.trim() ||
                        p.code.toLowerCase().includes(permissionFilter.toLowerCase()) ||
                        p.description?.toLowerCase().includes(permissionFilter.toLowerCase()) ||
                        moduleCode.toLowerCase().includes(permissionFilter.toLowerCase())
                    );

                    if (filtered.length === 0) return null;

                    const allModuleSelected = perms.every((p) =>
                      selectedPermissions.includes(p.code)
                    );
                    const someModuleSelected = perms.some((p) =>
                      selectedPermissions.includes(p.code)
                    );

                    return (
                      <div
                        key={moduleCode}
                        className="rounded-xl border border-slate-200/80 overflow-hidden"
                      >
                        {/* Module Group Header */}
                        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-indigo-600" />
                            <span className="text-xs font-bold text-slate-900 tracking-wider">
                              MODULE: {moduleCode}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                              {perms.filter((p) => selectedPermissions.includes(p.code)).length} /{" "}
                              {perms.length}
                            </span>
                          </div>

                          {!isSystemRole && (
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleModuleAll(moduleCode, !allModuleSelected)
                              }
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                              {allModuleSelected ? "Deselect All" : "Select All"}
                            </button>
                          )}
                        </div>

                        {/* Permission Checkbox List */}
                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2 bg-white">
                          {filtered.map((perm) => {
                            const isGranted =
                              isSystemRole && activeRole.name.toUpperCase() === "OWNER"
                                ? true
                                : selectedPermissions.includes(perm.code);

                            return (
                              <label
                                key={perm.code}
                                className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all ${
                                  isGranted
                                    ? "bg-indigo-50/50 border-indigo-200"
                                    : "bg-white border-slate-100 hover:border-slate-200"
                                } ${isSystemRole ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={isSystemRole}
                                  checked={isGranted}
                                  onChange={() => handleTogglePermission(perm.code)}
                                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-0.5 disabled:opacity-50 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-mono font-bold text-slate-800 truncate">
                                    {perm.code}
                                  </p>
                                  {perm.description && (
                                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                      {perm.description}
                                    </p>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <EmptyState
                title="Select a role"
                description="Choose a role from the left list to review and assign permissions."
                icon={<ShieldCheck className="w-8 h-8 text-slate-400" />}
              />
            )}
          </div>
        </div>
      )}

      {/* Floating Unsaved Changes Bar */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <span className="text-xs font-semibold">
              Unsaved permission modifications for role &quot;{activeRole?.name}&quot;
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDiscardChanges}
              className="text-xs h-8 text-slate-300 bg-slate-800 border-slate-700 hover:bg-slate-700 hover:text-white"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Discard
            </Button>

            <Button
              size="sm"
              onClick={handleSavePermissions}
              disabled={isSavingPermissions}
              className="text-xs h-8 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-xs"
            >
              {isSavingPermissions ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1" />
                  Save Permissions
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Create Custom Role Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Custom Role"
        description="Define a new organizational role with customizable privilege boundaries."
        maxWidth="md"
      >
        <form onSubmit={handleCreateRole} className="space-y-4">
          {createRoleError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-800">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{createRoleError}</span>
            </div>
          )}

          <Input
            label="Role Code / Name"
            required
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value.toUpperCase())}
            placeholder="e.g. SALES_MANAGER, HR_REPRESENTATIVE"
            helperText="Uppercase alphanumeric role name identifier."
          />

          <Input
            label="Role Description"
            value={newRoleDesc}
            onChange={(e) => setNewRoleDesc(e.target.value)}
            placeholder="e.g. Can generate invoices, manage leads, and approve team quotations."
          />

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreatingRole}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2 rounded-xl"
            >
              {isCreatingRole ? "Creating Role..." : "Create Role"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function RolesManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-4">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      }
    >
      <RolesManagementContent />
    </Suspense>
  );
}
