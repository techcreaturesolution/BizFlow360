"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Hash,
  Mail,
  Phone,
  CreditCard,
  FileCheck,
  AlertCircle,
  Plus,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createCustomer } from "@/lib/crm";
import type { CustomerItem, CustomerType } from "@/types/crm";

const CUSTOMER_TYPE_OPTIONS = [
  { value: "B2B", label: "B2B (Business to Business)" },
  { value: "B2C", label: "B2C (Individual Consumer)" },
  { value: "ENTERPRISE", label: "Enterprise Account" },
  { value: "PARTNER", label: "Channel Partner / Distributor" },
];

interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: CustomerItem) => void;
}

export function CreateCustomerModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateCustomerModalProps) {
  const [customerCode, setCustomerCode] = useState("");
  const [name, setName] = useState("");
  const [customerType, setCustomerType] = useState<CustomerType>("B2B");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState<number | string>(30);
  const [creditLimit, setCreditLimit] = useState<number | string>(500000);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCustomerCode(`CUST-${String(Date.now()).slice(-6)}`);
      setName("");
      setCustomerType("B2B");
      setEmail("");
      setPhone("");
      setTaxId("");
      setPaymentTermsDays(30);
      setCreditLimit(500000);
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Customer or organization name is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await createCustomer({
        customerCode: customerCode.trim() || undefined,
        name: name.trim(),
        customerType,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        taxId: taxId.trim() || undefined,
        paymentTermsDays: Number(paymentTermsDays) || 30,
        creditLimit: Number(creditLimit) || 0,
      });

      onSuccess(res.customer);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create customer account.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Customer Account"
      description="Register an enterprise client, commercial partner, or retail account."
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
            label="Organization / Customer Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Apex Industries Pvt Ltd"
            leftIcon={<Building2 className="h-4 w-4 text-slate-400" />}
            required
          />

          <Input
            label="Customer Code"
            value={customerCode}
            onChange={(e) => setCustomerCode(e.target.value)}
            placeholder="e.g. CUST-1001"
            leftIcon={<Hash className="h-4 w-4 text-slate-400" />}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Account Classification"
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value as CustomerType)}
            options={CUSTOMER_TYPE_OPTIONS}
          />

          <Input
            label="Primary Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="billing@apexindustries.com"
            leftIcon={<Mail className="h-4 w-4 text-slate-400" />}
          />

          <Input
            label="Phone Contact"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 00000"
            leftIcon={<Phone className="h-4 w-4 text-slate-400" />}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Tax ID / GSTIN / VAT"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder="24AABCA1234D1Z5"
            leftIcon={<Hash className="h-4 w-4 text-slate-400" />}
          />

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
            label="Credit Limit (₹)"
            type="number"
            min="0"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            placeholder="500000"
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
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Create Customer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
