import React from "react";
import type { AuditDiffField } from "@/types/platform";

interface DiffTableProps {
  diff?: AuditDiffField[];
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

export function DiffTable({ diff }: DiffTableProps) {
  if (!diff || diff.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-6 text-center text-xs text-slate-500">
        No field-level changes recorded in this audit entry.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
          <tr>
            <th className="py-2.5 px-4 w-1/4">Modified Field</th>
            <th className="py-2.5 px-4 w-3/8 text-rose-700">Before Value</th>
            <th className="py-2.5 px-4 w-3/8 text-emerald-700">After Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
          {diff.map((item, idx) => (
            <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
              <td className="py-2.5 px-4 font-bold text-slate-800">
                {item.field}
              </td>
              <td className="py-2.5 px-4 text-rose-600 bg-rose-50/30 break-all">
                {formatValue(item.before)}
              </td>
              <td className="py-2.5 px-4 text-emerald-700 bg-emerald-50/30 font-semibold break-all">
                {formatValue(item.after)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
