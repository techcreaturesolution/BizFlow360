"use client";

import React, { useState, useEffect } from "react";
import { UserCheck, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { assignLead } from "@/lib/crm";
import { getTeamMembers } from "@/lib/tenant";
import type { LeadItem } from "@/types/crm";
import type { TeamMember } from "@/types/tenant";

interface AssignLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: LeadItem;
  onSuccess: (updatedLead: LeadItem) => void;
}

export function AssignLeadModal({
  isOpen,
  onClose,
  lead,
  onSuccess,
}: AssignLeadModalProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState(lead.ownerUserId || "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoadingMembers(true);
      getTeamMembers({ limit: 100 })
        .then((res) => {
          setTeamMembers(res.members || []);
        })
        .catch(() => {})
        .finally(() => setLoadingMembers(false));
      setOwnerUserId(lead.ownerUserId || "");
      setNote("");
      setError(null);
    }
  }, [isOpen, lead.ownerUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerUserId) {
      setError("Please select a team member to assign this lead to.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await assignLead(lead.id, {
        ownerUserId,
        note: note.trim() || undefined,
      });
      onSuccess(res.lead);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to assign lead.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const userOptions = [
    { value: "", label: loadingMembers ? "Loading team members..." : "Select assignee..." },
    ...teamMembers.map((m) => ({
      value: m.userId,
      label: `${m.fullName} (${m.roleName || m.roles[0] || "Member"}) - ${m.email}`,
    })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Lead Record"
      description={`Transfer ownership of ${lead.name} to another sales representative.`}
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
          label="New Representative Owner *"
          value={ownerUserId}
          onChange={(e) => setOwnerUserId(e.target.value)}
          options={userOptions}
          required
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Assignment Note / Handover Instructions (Optional)
          </label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Followed up on demo, customer requested customized proposal..."
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
            leftIcon={<UserCheck className="h-4 w-4" />}
          >
            Confirm Assignment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
