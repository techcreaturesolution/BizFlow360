"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Building,
  Mail,
  Phone,
  Tag,
  DollarSign,
  Calendar,
  FileText,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createLead, updateLead } from "@/lib/crm";
import { getTeamMembers } from "@/lib/tenant";
import type {
  LeadItem,
  CreateLeadInput,
  UpdateLeadInput,
  LeadStage,
  LeadPriority,
} from "@/types/crm";
import type { TeamMember } from "@/types/tenant";

const STAGE_OPTIONS = [
  { value: "NEW", label: "New Lead" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL", label: "Proposal Sent" },
  { value: "NEGOTIATION", label: "In Negotiation" },
  { value: "WON", label: "Won / Closed" },
  { value: "LOST", label: "Lost" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low Priority" },
  { value: "MEDIUM", label: "Medium Priority" },
  { value: "HIGH", label: "High Priority" },
  { value: "URGENT", label: "Urgent Priority" },
];

interface LeadUpsertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lead: LeadItem) => void;
  leadToEdit?: LeadItem | null;
}

export function LeadUpsertModal({
  isOpen,
  onClose,
  onSuccess,
  leadToEdit,
}: LeadUpsertModalProps) {
  const isEdit = !!leadToEdit;

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [stage, setStage] = useState<LeadStage>("NEW");
  const [priority, setPriority] = useState<LeadPriority>("MEDIUM");
  const [estimatedValue, setEstimatedValue] = useState<number | string>(0);
  const [ownerUserId, setOwnerUserId] = useState<string>("");
  const [nextFollowupAt, setNextFollowupAt] = useState<string>("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load team members for owner assignment dropdown
  useEffect(() => {
    if (isOpen) {
      setLoadingMembers(true);
      getTeamMembers({ limit: 100 })
        .then((res) => {
          setTeamMembers(res.members || []);
        })
        .catch(() => {})
        .finally(() => setLoadingMembers(false));
    }
  }, [isOpen]);

  // Pre-fill form on edit or reset on create
  useEffect(() => {
    if (leadToEdit) {
      setName(leadToEdit.name || "");
      setCompanyName(leadToEdit.companyName || "");
      setEmail(leadToEdit.email || "");
      setPhone(leadToEdit.phone || "");
      setSource(leadToEdit.source || "");
      setStage(leadToEdit.stage || "NEW");
      setPriority(leadToEdit.priority || "MEDIUM");
      setEstimatedValue(leadToEdit.estimatedValue ?? 0);
      setOwnerUserId(leadToEdit.ownerUserId || "");
      setNextFollowupAt(
        leadToEdit.nextFollowupAt
          ? new Date(leadToEdit.nextFollowupAt).toISOString().slice(0, 16)
          : ""
      );
      setNotes(leadToEdit.notes || "");
    } else {
      setName("");
      setCompanyName("");
      setEmail("");
      setPhone("");
      setSource("");
      setStage("NEW");
      setPriority("MEDIUM");
      setEstimatedValue(0);
      setOwnerUserId("");
      setNextFollowupAt("");
      setNotes("");
    }
    setError(null);
  }, [leadToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Lead contact name is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const parsedValue = Number(estimatedValue) || 0;
      const formattedDate = nextFollowupAt
        ? new Date(nextFollowupAt).toISOString()
        : undefined;

      if (isEdit && leadToEdit) {
        // Send only changed fields for PATCH
        const patchPayload: UpdateLeadInput = {};
        if (name.trim() !== leadToEdit.name) patchPayload.name = name.trim();
        if ((companyName.trim() || undefined) !== (leadToEdit.companyName || undefined)) {
          patchPayload.companyName = companyName.trim() || undefined;
        }
        if ((email.trim() || undefined) !== (leadToEdit.email || undefined)) {
          patchPayload.email = email.trim() || undefined;
        }
        if ((phone.trim() || undefined) !== (leadToEdit.phone || undefined)) {
          patchPayload.phone = phone.trim() || undefined;
        }
        if ((source.trim() || undefined) !== (leadToEdit.source || undefined)) {
          patchPayload.source = source.trim() || undefined;
        }
        if (stage !== leadToEdit.stage) patchPayload.stage = stage;
        if (priority !== leadToEdit.priority) patchPayload.priority = priority;
        if (parsedValue !== leadToEdit.estimatedValue) {
          patchPayload.estimatedValue = parsedValue;
        }
        if ((ownerUserId || undefined) !== (leadToEdit.ownerUserId || undefined)) {
          patchPayload.ownerUserId = ownerUserId || undefined;
        }
        if (formattedDate !== (leadToEdit.nextFollowupAt || undefined)) {
          patchPayload.nextFollowupAt = formattedDate;
        }
        if ((notes.trim() || undefined) !== (leadToEdit.notes || undefined)) {
          patchPayload.notes = notes.trim() || undefined;
        }

        const res = await updateLead(leadToEdit.id, patchPayload);
        onSuccess(res.lead);
      } else {
        const createPayload: CreateLeadInput = {
          name: name.trim(),
          companyName: companyName.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          source: source.trim() || undefined,
          stage,
          priority,
          estimatedValue: parsedValue,
          ownerUserId: ownerUserId || undefined,
          nextFollowupAt: formattedDate,
          notes: notes.trim() || undefined,
        };

        const res = await createLead(createPayload);
        onSuccess(res.lead);
      }
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to save lead record. Please check the inputs.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const userOptions = [
    { value: "", label: loadingMembers ? "Loading owners..." : "Unassigned / Auto" },
    ...teamMembers.map((m) => ({
      value: m.userId,
      label: `${m.fullName} (${m.roleName || m.roles[0] || "Member"})`,
    })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit CRM Lead" : "Create New CRM Lead"}
      description={
        isEdit
          ? "Update contact info, deal stage, priority, or assigned representative."
          : "Add an inbound prospect or deal opportunity to your sales pipeline."
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Contact Full Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Vikram Patel"
            leftIcon={<User className="h-4 w-4 text-slate-400" />}
            required
          />

          <Input
            label="Company / Business Name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Patel Logistics Pvt Ltd"
            leftIcon={<Building className="h-4 w-4 text-slate-400" />}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vikram@patellogistics.com"
            leftIcon={<Mail className="h-4 w-4 text-slate-400" />}
          />

          <Input
            label="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            leftIcon={<Phone className="h-4 w-4 text-slate-400" />}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Deal Stage"
            value={stage}
            onChange={(e) => setStage(e.target.value as LeadStage)}
            options={STAGE_OPTIONS}
          />

          <Select
            label="Priority Level"
            value={priority}
            onChange={(e) => setPriority(e.target.value as LeadPriority)}
            options={PRIORITY_OPTIONS}
          />

          <Input
            label="Estimated Deal Value (₹)"
            type="number"
            min="0"
            step="any"
            value={estimatedValue}
            onChange={(e) => setEstimatedValue(e.target.value)}
            placeholder="250000"
            leftIcon={<DollarSign className="h-4 w-4 text-slate-400" />}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Lead Source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Website, Referral, Event..."
            leftIcon={<Tag className="h-4 w-4 text-slate-400" />}
          />

          <Select
            label="Assigned Representative"
            value={ownerUserId}
            onChange={(e) => setOwnerUserId(e.target.value)}
            options={userOptions}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Next Followup Date & Time
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                value={nextFollowupAt}
                onChange={(e) => setNextFollowupAt(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Internal Notes / Requirement Context
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add background details, customer requirements, or key deal drivers..."
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            {isEdit ? "Update Lead" : "Create Lead"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
