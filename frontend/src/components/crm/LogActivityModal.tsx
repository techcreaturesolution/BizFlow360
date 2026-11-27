"use client";

import React, { useState } from "react";
import { MessageSquare, Phone, Mail, Users, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { logLeadActivity } from "@/lib/crm";
import type { LeadActivity } from "@/types/crm";

interface LogActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  onSuccess: (activity: LeadActivity) => void;
}

const ACTIVITY_TYPE_OPTIONS = [
  { value: "NOTE", label: "Note / General Comment" },
  { value: "CALL", label: "Phone Call Log" },
  { value: "EMAIL", label: "Email Correspondence" },
  { value: "MEETING", label: "Meeting / Discussion" },
];

export function LogActivityModal({
  isOpen,
  onClose,
  leadId,
  leadName,
  onSuccess,
}: LogActivityModalProps) {
  const [activityType, setActivityType] = useState<"NOTE" | "CALL" | "EMAIL" | "MEETING">("NOTE");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      setError("Activity summary is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await logLeadActivity(leadId, {
        activityType,
        summary: summary.trim(),
        details: details.trim() ? { notes: details.trim() } : undefined,
      });
      onSuccess(res.activity);
      setSummary("");
      setDetails("");
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to log activity.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Log Lead Activity"
      description={`Record a touchpoint or note for ${leadName}.`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Select
          label="Activity Type *"
          value={activityType}
          onChange={(e) =>
            setActivityType(e.target.value as "NOTE" | "CALL" | "EMAIL" | "MEETING")
          }
          options={ACTIVITY_TYPE_OPTIONS}
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Summary / Headline *
          </label>
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="e.g. Discussed pricing tiers and customization requirements"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Additional Notes / Next Steps (Optional)
          </label>
          <textarea
            rows={4}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Detailed meeting minutes, caller responses, or action items..."
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            Save Activity
          </Button>
        </div>
      </form>
    </Modal>
  );
}
