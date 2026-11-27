import React from "react";

interface MoneyTextProps {
  amount?: number | null;
  currency?: string | null;
  className?: string;
}

export function MoneyText({
  amount = 0,
  currency = "INR",
  className = "",
}: MoneyTextProps) {
  const curr = (currency || "INR").toUpperCase();
  const val = Number(amount) || 0;

  let formatted = `${curr} ${val.toLocaleString()}`;
  try {
    formatted = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: curr,
      maximumFractionDigits: 2,
    }).format(val);
  } catch {
    formatted = `${curr} ${val.toFixed(2)}`;
  }

  return <span className={className}>{formatted}</span>;
}
