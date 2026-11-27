"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers,
  LayoutDashboard,
  BarChart3,
  FileSpreadsheet,
  Users,
  Briefcase,
  Contact,
  ShoppingBag,
  FileCheck,
  Receipt,
  CreditCard,
  CheckSquare,
  FolderArchive,
  CheckCircle2,
  Building2,
  GitFork,
  Network,
  Users2,
  ShieldCheck,
  Coins,
  Bell,
  ChevronRight,
  ExternalLink,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTenant } from "@/lib/storage";
import { getTenantSubscription } from "@/lib/tenant";
import type { TenantInfo } from "@/types/auth";
import type { TenantSubscriptionInfo } from "@/types/tenant";

interface TenantSidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

interface NavGroup {
  groupTitle: string;
  moduleCode?: string; // If set, checked against entitlements
  items: NavItem[];
}

export function TenantSidebar({ isOpen, onClose }: TenantSidebarProps) {
  const pathname = usePathname();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [subscription, setSubscription] = useState<TenantSubscriptionInfo | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setTenant(getTenant());
    getTenantSubscription()
      .then((sub) => setSubscription(sub))
      .catch(() => setSubscription(null));

    const handleUpdate = () => {
      setTenant(getTenant());
    };
    window.addEventListener("tenant_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("tenant_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Determine if a module is enabled from subscription entitlements
  const isModuleEnabled = (moduleCode?: string): boolean => {
    if (!moduleCode) return true; // Core group always shown
    if (!subscription || !subscription.modules || subscription.modules.length === 0) {
      // If unknown shape or empty or failed, show all groups by default
      return true;
    }
    const found = subscription.modules.find(
      (m) =>
        m.moduleCode?.toUpperCase() === moduleCode.toUpperCase() ||
        (m as unknown as { module_code?: string }).module_code?.toUpperCase() ===
          moduleCode.toUpperCase()
    );
    return found ? Boolean(found.enabled ?? found.is_enabled ?? true) : true;
  };

  const navGroups: NavGroup[] = [
    {
      groupTitle: "Core",
      items: [
        {
          title: "Overview",
          href: "/dashboard",
          icon: <LayoutDashboard className="h-4 w-4" />,
        },
      ],
    },
    {
      groupTitle: "Analytics & Reports",
      items: [
        {
          title: "Analytics",
          href: "/dashboard/analytics",
          icon: <BarChart3 className="h-4 w-4" />,
        },
        {
          title: "Reports",
          href: "/dashboard/reports",
          icon: <FileSpreadsheet className="h-4 w-4" />,
        },
      ],
    },
    {
      groupTitle: "CRM",
      moduleCode: "CRM",
      items: [
        {
          title: "Pipeline",
          href: "/dashboard/crm/pipeline",
          icon: <Briefcase className="h-4 w-4" />,
        },
        {
          title: "Leads",
          href: "/dashboard/crm/leads",
          icon: <Contact className="h-4 w-4" />,
        },
        {
          title: "Customers",
          href: "/dashboard/crm/customers",
          icon: <Users className="h-4 w-4" />,
        },
      ],
    },
    {
      groupTitle: "Sales",
      moduleCode: "SALES",
      items: [
        {
          title: "Products & Services",
          href: "/dashboard/sales/products",
          icon: <ShoppingBag className="h-4 w-4" />,
        },
        {
          title: "Quotations",
          href: "/dashboard/sales/quotations",
          icon: <FileCheck className="h-4 w-4" />,
        },
        {
          title: "Sales Orders",
          href: "/dashboard/sales/orders",
          icon: <Receipt className="h-4 w-4" />,
        },
        {
          title: "Invoices",
          href: "/dashboard/sales/invoices",
          icon: <Coins className="h-4 w-4" />,
        },
      ],
    },
    {
      groupTitle: "Finance",
      moduleCode: "FINANCE",
      items: [
        {
          title: "Expenses",
          href: "/dashboard/finance/expenses",
          icon: <CreditCard className="h-4 w-4" />,
        },
        {
          title: "Receivables",
          href: "/dashboard/finance/receivables",
          icon: <Coins className="h-4 w-4" />,
        },
      ],
    },
    {
      groupTitle: "Workflows",
      moduleCode: "TASKS",
      items: [
        {
          title: "Tasks",
          href: "/dashboard/tasks",
          icon: <CheckSquare className="h-4 w-4" />,
        },
      ],
    },
    {
      groupTitle: "Documents",
      moduleCode: "DOCUMENTS",
      items: [
        {
          title: "Documents",
          href: "/dashboard/documents",
          icon: <FolderArchive className="h-4 w-4" />,
        },
      ],
    },
    {
      groupTitle: "Governance",
      items: [
        {
          title: "Approvals",
          href: "/dashboard/approvals",
          icon: <CheckCircle2 className="h-4 w-4" />,
        },
      ],
    },
    {
      groupTitle: "Company Setup",
      items: [
        {
          title: "Company Profile",
          href: "/dashboard/company",
          icon: <Building2 className="h-4 w-4" />,
        },
        {
          title: "Branches",
          href: "/dashboard/company/branches",
          icon: <GitFork className="h-4 w-4" />,
        },
        {
          title: "Departments",
          href: "/dashboard/company/departments",
          icon: <Network className="h-4 w-4" />,
        },
        {
          title: "Teams",
          href: "/dashboard/company/teams",
          icon: <Users2 className="h-4 w-4" />,
        },
      ],
    },
    {
      groupTitle: "Team & Access",
      items: [
        {
          title: "Members",
          href: "/dashboard/team",
          icon: <Users className="h-4 w-4" />,
        },
        {
          title: "Roles & Permissions",
          href: "/dashboard/team/roles",
          icon: <ShieldCheck className="h-4 w-4" />,
        },
      ],
    },
    {
      groupTitle: "Workspace Administration",
      items: [
        {
          title: "Billing & Plans",
          href: "/dashboard/billing",
          icon: <Coins className="h-4 w-4" />,
        },
        {
          title: "Notifications Settings",
          href: "/dashboard/settings/notifications",
          icon: <Bell className="h-4 w-4" />,
        },
      ],
    },
  ];

  const toggleGroup = (groupTitle: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupTitle]: !prev[groupTitle],
    }));
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden animate-fadeIn"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-950 text-white flex flex-col transition-transform duration-300 ease-in-out border-r border-slate-800/80 shadow-2xl lg:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800/80 bg-slate-950/90 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-md shadow-indigo-500/20 ring-1 ring-white/10 group-hover:scale-105 transition-transform">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
                BizFlow
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="block text-[10px] uppercase font-bold tracking-widest text-indigo-400 -mt-0.5">
                Workspace Hub
              </span>
            </div>
          </Link>
        </div>

        {/* Workspace Chip */}
        <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-900/50 shrink-0">
          <Link
            href="/dashboard/company"
            className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors group"
            title="View workspace settings"
          >
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span className="font-bold text-xs text-slate-200 truncate group-hover:text-white">
                  {tenant?.name || "My Organization"}
                </span>
              </div>
              <span className="block font-mono text-[10px] text-slate-400 truncate mt-0.5">
                {tenant?.slug ? `${tenant.slug}.bizflow.app` : "bizflow.app"}
              </span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-300 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Scrollable Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-5 scrollbar-thin scrollbar-thumb-slate-800">
          {navGroups
            .filter((group) => isModuleEnabled(group.moduleCode))
            .map((group) => {
              const isCollapsed = Boolean(collapsedGroups[group.groupTitle]);
              return (
                <div key={group.groupTitle} className="space-y-1">
                  {/* Group Header */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.groupTitle)}
                    className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <span>{group.groupTitle}</span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform duration-200 text-slate-500",
                        isCollapsed && "-rotate-90"
                      )}
                    />
                  </button>

                  {/* Nav Links */}
                  {!isCollapsed && (
                    <div className="space-y-0.5 pt-0.5">
                      {group.items.map((item) => {
                        const isActive =
                          pathname === item.href ||
                          (item.href !== "/dashboard" &&
                            pathname.startsWith(`${item.href}/`));

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={onClose}
                            className={cn(
                              "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 group",
                              isActive
                                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                                : "text-slate-400 hover:text-slate-100 hover:bg-slate-900"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={cn(
                                  "transition-colors shrink-0",
                                  isActive
                                    ? "text-white"
                                    : "text-slate-400 group-hover:text-slate-200"
                                )}
                              >
                                {item.icon}
                              </span>
                              <span className="truncate">{item.title}</span>
                            </div>

                            {item.badge && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500 text-white">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </nav>

        {/* Footer info */}
        <div className="p-3.5 border-t border-slate-800/80 bg-slate-950 text-center text-[10px] text-slate-500 shrink-0">
          BizFlow Enterprise Platform © 2026
        </div>
      </aside>
    </>
  );
}
