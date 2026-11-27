"use client";

import React, { useState } from "react";
import { Copy, Check, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface JsonViewerProps {
  data: unknown;
  title?: string;
  defaultExpanded?: boolean;
}

export function JsonViewer({
  data,
  title = "Payload JSON",
  defaultExpanded = true,
}: JsonViewerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isCopied, setIsCopied] = useState(false);

  const formattedJson =
    data !== undefined && data !== null
      ? JSON.stringify(data, null, 2)
      : "null";

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJson);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 text-slate-200 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900/90 border-b border-slate-800 text-xs">
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-1.5 font-mono font-medium text-slate-300 hover:text-white"
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          <span>{title}</span>
        </button>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          leftIcon={
            isCopied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3 text-slate-400" />
            )
          }
          className="h-6 text-[10px] text-slate-300 hover:text-white hover:bg-slate-800 px-2"
        >
          {isCopied ? "Copied" : "Copy JSON"}
        </Button>
      </div>

      {isExpanded && (
        <pre className="p-3 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-96 text-emerald-300 selection:bg-indigo-600 selection:text-white">
          {formattedJson}
        </pre>
      )}
    </div>
  );
}
