"use client";

import React from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import type { BranchItem, DashboardPeriod, DepartmentItem } from "@/types/tenant";
import { RefreshCw } from "lucide-react";

export const PERIOD_OPTIONS = [
  { value: "TODAY", label: "Today" },
  { value: "7D", label: "7 Days" },
  { value: "30D", label: "30 Days" },
  { value: "90D", label: "90 Days" },
  { value: "YTD", label: "YTD" },
  { value: "CUSTOM", label: "Custom" },
];

interface DashboardFilterBarProps {
  period: DashboardPeriod;
  onPeriodChange: (val: DashboardPeriod) => void;
  fromDate?: string;
  onFromDateChange?: (date: string) => void;
  toDate?: string;
  onToDateChange?: (date: string) => void;
  branchId?: string;
  onBranchIdChange?: (id: string) => void;
  departmentId?: string;
  onDepartmentIdChange?: (id: string) => void;
  branches?: BranchItem[];
  departments?: DepartmentItem[];
  onApply: () => void;
  onReset: () => void;
  isLoading?: boolean;
  extraActions?: React.ReactNode;
  className?: string;
}

export function DashboardFilterBar({
  period,
  onPeriodChange,
  fromDate = "",
  onFromDateChange,
  toDate = "",
  onToDateChange,
  branchId = "",
  onBranchIdChange,
  departmentId = "",
  onDepartmentIdChange,
  branches = [],
  departments = [],
  onApply,
  onReset,
  isLoading = false,
  extraActions,
  className = "",
}: DashboardFilterBarProps) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4 ${className}`}>
      {/* Top row: Period segmented control + Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="block text-xs font-bold text-slate-700">
            Reporting Period
          </span>
          <SegmentedControl
            options={PERIOD_OPTIONS}
            value={period}
            onChange={(val) => onPeriodChange(val as DashboardPeriod)}
          />
        </div>

        <div className="flex items-center gap-2 self-end lg:self-center">
          {extraActions}
          <Button
            size="sm"
            variant="outline"
            onClick={onApply}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            className="text-xs"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Extended Filter Controls (Dates, Branch, Department) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 items-end text-xs">
        {period === "CUSTOM" && onFromDateChange && onToDateChange && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => onFromDateChange(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => onToDateChange(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>
          </>
        )}

        {onBranchIdChange && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Filter by Branch
            </label>
            <select
              value={branchId}
              onChange={(e) => onBranchIdChange(e.target.value)}
              className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-800 bg-white focus:outline-none focus:border-indigo-600"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.code ? `(${b.code})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {onDepartmentIdChange && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Filter by Department
            </label>
            <select
              value={departmentId}
              onChange={(e) => onDepartmentIdChange(e.target.value)}
              className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-800 bg-white focus:outline-none focus:border-indigo-600"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={onApply}
            className="h-9 px-4 text-xs"
          >
            Apply
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onReset}
            className="h-9 text-xs text-slate-500 hover:text-slate-800"
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
