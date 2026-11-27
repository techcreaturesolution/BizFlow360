"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Building2,
  Hash,
  CreditCard,
  FileCheck,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { convertLeadToCustomer } from "@/lib/crm";
import type { LeadItem, CustomerType, CustomerItem } from "@/types/crm";

const CUSTOMER_TYPE_OPTIONS = [
  { value: "B2B", label: "B2B (Business to Business)" },
  { value: "B2C", label: "B2C (Individual Consumer)" },
  { value: "ENTERPRISE", label: "Enterprise Account" },
  { value: "PARTNER", label: "Channel Partner / Distributor" },
];

interface ConvertLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: LeadItem;
  onSuccess: (customer: CustomerItem, updatedLead: LeadItem) => void;
}

export function ConvertLeadModal({
  isOpen,
  onClose,
  lead,
  onSuccess,
}: ConvertLeadModalProps) {
  const router = useRouter();

  const [customerCode, setCustomerCode] = useState("");
  const [customerType, setCustomerType] = useState<CustomerType>("B2B");
  const [taxId, setTaxId] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState<number | string>(30);
  const [creditLimit, setCreditLimit] = useState<number | string>(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convertedCustomer, setConvertedCustomer] = useState<CustomerItem | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCustomerCode(`CUST-${String(Date.now()).slice(-6)}`);
      setCustomerType("B2B");
      setTaxId("");
      setPaymentTermsDays(30);
      setCreditLimit(0);
      setError(null);
      setConvertedCustomer(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await convertLeadToCustomer(lead.id, {
        customerCode: customerCode.trim() || undefined,
        customerType,
        taxId: taxId.trim() || undefined,
        paymentTermsDays: Number(paymentTermsDays) || 30,
        creditLimit: Number(creditLimit) || 0,
      });

      setConvertedCustomer(res.customer);
      onSuccess(res.customer, res.lead);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to convert lead to customer.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Convert Lead to Customer Account"
      description={`Transition ${lead.name} (${lead.companyName || "Lead"}) to an active client account.`}
      size="md"
    >
      {convertedCustomer ? (
        <div className="space-y-4 py-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900">Conversion Successful!</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {lead.name} has been converted into an official customer account with code{" "}
              <strong className="text-slate-800">{convertedCustomer.customerCode}</strong>.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-3">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              rightIcon={<ExternalLink className="h-4 w-4" />}
              onClick={() => {
                onClose();
                router.push(`/dashboard/crm/customers/${convertedCustomer.id}`);
              }}
            >
              Open Customer Profile
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="rounded-xl bg-indigo-50/60 border border-indigo-100 p-3 text-xs text-indigo-900 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Automatic Won Stage & Customer Creation</p>
              <p className="text-indigo-700 mt-0.5">
                Converting this lead will automatically mark its pipeline stage as{" "}
                <strong>WON</strong> and provision a permanent billing customer account.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Customer Code"
              value={customerCode}
              onChange={(e) => setCustomerCode(e.target.value)}
              placeholder="e.g. CUST-1001"
              leftIcon={<Hash className="h-4 w-4 text-slate-400" />}
            />

            <Select
              label="Customer Classification"
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value as CustomerType)}
              options={CUSTOMER_TYPE_OPTIONS}
            />
          </div>

          <Input
            label="Tax ID / GSTIN / VAT Number (Optional)"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder="e.g. 24AABCA1234D1Z5"
            leftIcon={<Building2 className="h-4 w-4 text-slate-400" />}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Payment Terms (Days)"
              type="number"
              min="0"
              max="365"
              value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(e.target.value)}
              placeholder="30"
              leftIcon={<FileCheck className="h-4 w-4 text-slate-400" />}
            />

            <Input
              label="Initial Credit Limit (₹)"
              type="number"
              min="0"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              placeholder="0"
              leftIcon={<CreditCard className="h-4 w-4 text-slate-400" />}
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
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
            >
              Convert to Customer
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
