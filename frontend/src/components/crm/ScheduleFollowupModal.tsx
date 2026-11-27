"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Clock, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { scheduleLeadFollowup } from "@/lib/crm";
import { getTeamMembers } from "@/lib/tenant";
import type { LeadFollowup } from "@/types/crm";
import type { TeamMember } from "@/types/tenant";

interface ScheduleFollowupModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  defaultAssignedUserId?: string | null;
  onSuccess: (followup: LeadFollowup) => void;
}

export function ScheduleFollowupModal({
  isOpen,
  onClose,
  leadId,
  leadName,
  defaultAssignedUserId,
  onSuccess,
}: ScheduleFollowupModalProps) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState(defaultAssignedUserId || "");
  const [notes, setNotes] = useState("");

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoadingMembers(true);
      getTeamMembers({ limit: 100 })
        .then((res) => setTeamMembers(res.members || []))
        .catch(() => {})
        .finally(() => setLoadingMembers(false));

      // Default to tomorrow at 10:00 AM
      const tmrw = new Date();
      tmrw.setDate(tmrw.getDate() + 1);
      tmrw.setHours(10, 0, 0, 0);
      setScheduledAt(tmrw.toISOString().slice(0, 16));
      setAssignedToUserId(defaultAssignedUserId || "");
      setNotes("");
      setError(null);
    }
  }, [isOpen, defaultAssignedUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledAt) {
      setError("Please select a valid followup date & time.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await scheduleLeadFollowup(leadId, {
        scheduledAt: new Date(scheduledAt).toISOString(),
        assignedToUserId: assignedToUserId || undefined,
        notes: notes.trim() || undefined,
      });
      onSuccess(res.followup);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to schedule followup.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const userOptions = [
    { value: "", label: loadingMembers ? "Loading..." : "Lead Owner / Default" },
    ...teamMembers.map((m) => ({
      value: m.userId,
      label: `${m.fullName} (${m.roleName || m.roles[0] || "Member"})`,
    })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule Follow-up Task"
      description={`Set a reminder and assign an action item for ${leadName}.`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Followup Date & Time *
          </label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            required
          />
        </div>

        <Select
          label="Assigned Team Member"
          value={assignedToUserId}
          onChange={(e) => setAssignedToUserId(e.target.value)}
          options={userOptions}
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Task Instructions / Agenda (Optional)
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Call to discuss updated quotation with procurement manager..."
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={submitting}
            leftIcon={<Calendar className="h-4 w-4" />}
          >
            Schedule Reminder
          </Button>
        </div>
      </form>
    </Modal>
  );
}
