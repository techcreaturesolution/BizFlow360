"use client";

import React, { useEffect, useState } from "react";
import { getTenants } from "@/lib/platform";
import type { TenantListItem } from "@/types/platform";
import { Select } from "@/components/ui/Select";

// In-memory cache for tenants select
let tenantsCache: TenantListItem[] | null = null;

interface TenantSelectProps {
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

export function TenantSelect({
  value,
  onChange,
  label = "Tenant Organization",
  placeholder = "Select an organization...",
  error,
  required,
  disabled,
  includeAllOption = false,
  allLabel = "All Tenants",
}: TenantSelectProps) {
  const [tenants, setTenants] = useState<TenantListItem[]>(tenantsCache || []);
  const [isLoading, setIsLoading] = useState(!tenantsCache);

  useEffect(() => {
    if (tenantsCache) {
      setTenants(tenantsCache);
      return;
    }

    let isMounted = true;
    getTenants({ limit: 100 })
      .then((res) => {
        if (isMounted) {
          tenantsCache = res.tenants;
          setTenants(res.tenants);
        }
      })
      .catch((err) => {
        console.error("Failed to load tenants dropdown:", err);
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
    ...tenants.map((t) => ({
      value: t.id,
      label: `${t.name} (${t.slug}.bizflow.app)`,
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
