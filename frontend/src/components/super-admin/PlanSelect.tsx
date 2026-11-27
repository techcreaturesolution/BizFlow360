"use client";

import React, { useEffect, useState } from "react";
import { getPlans } from "@/lib/platform";
import type { PlanItem } from "@/types/platform";
import { Select } from "@/components/ui/Select";

// In-memory module cache to avoid refetching on every render
let plansCache: PlanItem[] | null = null;

interface PlanSelectProps {
  value?: string;
  onChange: (val: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  includeAllOption?: boolean;
  allLabel?: string;
}

export function PlanSelect({
  value,
  onChange,
  label = "Subscription Plan",
  placeholder = "Select a plan...",
  error,
  required,
  disabled,
  includeAllOption = false,
  allLabel = "All Subscription Plans",
}: PlanSelectProps) {
  const [plans, setPlans] = useState<PlanItem[]>(plansCache || []);
  const [isLoading, setIsLoading] = useState(!plansCache);

  useEffect(() => {
    if (plansCache) {
      setPlans(plansCache);
      return;
    }

    let isMounted = true;
    getPlans({ limit: 100 })
      .then((res) => {
        if (isMounted) {
          plansCache = res.plans;
          setPlans(res.plans);
        }
      })
      .catch((err) => {
        console.error("Failed to load plans dropdown:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const options = [
    ...(includeAllOption ? [{ value: "", label: allLabel }] : [{ value: "", label: placeholder }]),
    ...plans.map((p) => ({
      value: p.id,
      label: `${p.name} (${p.code}) - ${p.currency} ${p.price}/${p.billing_interval.toLowerCase()}`,
    })),
  ];

  return (
    <Select
      label={label}
      required={required}
      disabled={disabled || isLoading}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      options={options}
      error={error}
    />
  );
}
