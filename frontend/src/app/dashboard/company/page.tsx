"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Image from "next/image";
import {
  Building2,
  MapPin,
  Globe,
  Hash,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Save,
  RefreshCw,
  Image as ImageIcon,
  Shield,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";

import { getCompanyProfile, updateCompanyProfile } from "@/lib/tenant";
import { updateTenant } from "@/lib/storage";
import {
  CompanyProfile,
  UpdateCompanyInput,
  AddressObject,
  NumberingPreferences,
  ModulePreferences,
} from "@/types/tenant";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { JsonViewer } from "@/components/ui/JsonViewer";

type CompanyTab = "profile" | "address" | "locale" | "numbering" | "preferences";

const CURRENCY_OPTIONS = [
  { value: "INR", label: "INR (₹) - Indian Rupee" },
  { value: "USD", label: "USD ($) - US Dollar" },
  { value: "EUR", label: "EUR (€) - Euro" },
  { value: "GBP", label: "GBP (£) - British Pound" },
  { value: "AED", label: "AED (د.إ) - UAE Dirham" },
  { value: "SGD", label: "SGD (S$) - Singapore Dollar" },
  { value: "CAD", label: "CAD (C$) - Canadian Dollar" },
  { value: "AUD", label: "AUD (A$) - Australian Dollar" },
];

const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST +05:30)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT)" },
  { value: "America/Chicago", label: "America/Chicago (CST/CDT)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET/CEST)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST +04:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT +08:00)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST +09:00)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST/AEDT)" },
];

const LOCALE_OPTIONS = [
  { value: "en-IN", label: "English (India) - en-IN" },
  { value: "en-US", label: "English (United States) - en-US" },
  { value: "en-GB", label: "English (United Kingdom) - en-GB" },
  { value: "en-AE", label: "English (UAE) - en-AE" },
  { value: "en-SG", label: "English (Singapore) - en-SG" },
  { value: "en-AU", label: "English (Australia) - en-AU" },
];

const FISCAL_YEAR_OPTIONS = [
  { value: "APR-MAR", label: "April - March (India, UK Standard)" },
  { value: "JAN-DEC", label: "January - December (Calendar Year / US)" },
  { value: "JUL-JUN", label: "July - June (Australia Standard)" },
  { value: "OCT-SEP", label: "October - September (US Federal)" },
];

function CompanySettingsContent() {
  const [activeTab, setActiveTab] = useState<CompanyTab>("profile");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Stored original profile for changed-fields diffing
  const [initialProfile, setInitialProfile] = useState<CompanyProfile | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [taxId, setTaxId] = useState("");

  const [address, setAddress] = useState<AddressObject>({
    line1: "",
    line2: "",
    city: "",
    state: "",
    country: "India",
    postalCode: "",
    phone: "",
    email: "",
  });

  const [locale, setLocale] = useState("en-IN");
  const [defaultCurrency, setDefaultCurrency] = useState("INR");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [financialYear, setFinancialYear] = useState("APR-MAR");

  const [numbering, setNumbering] = useState<NumberingPreferences>({
    invoicePrefix: "INV-",
    quotationPrefix: "QTN-",
    orderPrefix: "ORD-",
    nextInvoiceNumber: 1001,
    resetAnnually: true,
  });

  const [modulePrefs, setModulePrefs] = useState<ModulePreferences>({
    enableMultiBranch: true,
    defaultTaxRate: 18,
  });

  const [showRawJson, setShowRawJson] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);

  const loadCompanyData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    try {
      const data = await getCompanyProfile();
      setInitialProfile(data);

      setName(data.name || "");
      setLegalName(data.legalName || "");
      setSlug(data.slug || "");
      setLogoUrl(data.logoUrl || "");
      setTaxId(data.taxId || "");

      if (data.address) {
        setAddress({
          line1: data.address.line1 || "",
          line2: data.address.line2 || "",
          city: data.address.city || "",
          state: data.address.state || "",
          country: data.address.country || "India",
          postalCode: data.address.postalCode || "",
          phone: data.address.phone || "",
          email: data.address.email || "",
        });
      }

      if (data.locale) setLocale(data.locale);
      if (data.defaultCurrency) setDefaultCurrency(data.defaultCurrency);
      if (data.timezone) setTimezone(data.timezone);
      if (data.financialYear) setFinancialYear(data.financialYear);

      if (data.numberingPreferences) {
        setNumbering({
          invoicePrefix: data.numberingPreferences.invoicePrefix || "INV-",
          quotationPrefix: data.numberingPreferences.quotationPrefix || "QTN-",
          orderPrefix: data.numberingPreferences.orderPrefix || "ORD-",
          nextInvoiceNumber: data.numberingPreferences.nextInvoiceNumber ?? 1001,
          resetAnnually: data.numberingPreferences.resetAnnually ?? true,
        });
      }

      if (data.modulePreferences) {
        setModulePrefs({
          enableMultiBranch: data.modulePreferences.enableMultiBranch ?? true,
          defaultTaxRate: data.modulePreferences.defaultTaxRate ?? 18,
          ...data.modulePreferences,
        });
      }
    } catch (err: unknown) {
      console.warn("Failed to load company profile:", err);
      setLoadError("Unable to retrieve company profile. Please ensure you are logged in.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanyData();
  }, [loadCompanyData]);

  // Diffing helper: compare and send ONLY changed fields
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    const changed: UpdateCompanyInput = {};

    if (name.trim() !== (initialProfile?.name || "")) {
      changed.name = name.trim();
    }
    if (legalName.trim() !== (initialProfile?.legalName || "")) {
      changed.legalName = legalName.trim();
    }
    if (logoUrl.trim() !== (initialProfile?.logoUrl || "")) {
      changed.logoUrl = logoUrl.trim();
    }
    if (taxId.trim() !== (initialProfile?.taxId || "")) {
      changed.taxId = taxId.trim();
    }
    if (locale !== (initialProfile?.locale || "en-IN")) {
      changed.locale = locale;
    }
    if (defaultCurrency !== (initialProfile?.defaultCurrency || "INR")) {
      changed.defaultCurrency = defaultCurrency;
    }
    if (timezone !== (initialProfile?.timezone || "Asia/Kolkata")) {
      changed.timezone = timezone;
    }
    if (financialYear !== (initialProfile?.financialYear || "APR-MAR")) {
      changed.financialYear = financialYear;
    }

    // Address diff
    const initAddr = initialProfile?.address || {};
    const addrChanged =
      address.line1 !== (initAddr.line1 || "") ||
      address.line2 !== (initAddr.line2 || "") ||
      address.city !== (initAddr.city || "") ||
      address.state !== (initAddr.state || "") ||
      address.country !== (initAddr.country || "") ||
      address.postalCode !== (initAddr.postalCode || "") ||
      address.phone !== (initAddr.phone || "") ||
      address.email !== (initAddr.email || "");

    if (addrChanged) {
      changed.address = address;
    }

    // Numbering diff
    const initNum = initialProfile?.numberingPreferences || {};
    const numChanged =
      numbering.invoicePrefix !== (initNum.invoicePrefix || "") ||
      numbering.quotationPrefix !== (initNum.quotationPrefix || "") ||
      numbering.orderPrefix !== (initNum.orderPrefix || "") ||
      numbering.nextInvoiceNumber !== (initNum.nextInvoiceNumber ?? 1001) ||
      numbering.resetAnnually !== (initNum.resetAnnually ?? true);

    if (numChanged) {
      changed.numberingPreferences = numbering;
    }

    // Preferences diff
    const initPref = initialProfile?.modulePreferences || {};
    const prefChanged =
      modulePrefs.enableMultiBranch !== (initPref.enableMultiBranch ?? true) ||
      modulePrefs.defaultTaxRate !== (initPref.defaultTaxRate ?? 18);

    if (prefChanged) {
      changed.modulePreferences = modulePrefs;
    }

    // If nothing changed, notify user
    if (Object.keys(changed).length === 0) {
      setSaveSuccessMsg("No modifications detected. Your profile is already up to date.");
      setIsSaving(false);
      return;
    }

    try {
      const updated = await updateCompanyProfile(changed);
      setInitialProfile(updated);

      // Refresh stored tenant/company info for workspace chip and app locale
      updateTenant({
        name: updated.name || name,
        timezone: updated.timezone || timezone,
        defaultCurrency: updated.defaultCurrency || defaultCurrency,
        slug: updated.slug || slug,
      });

      setSaveSuccessMsg("Company profile and preferences updated successfully!");
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string; error?: string } } };
      const msg =
        errorObj?.response?.data?.message ||
        errorObj?.response?.data?.error ||
        "Failed to save company settings. Please verify field values.";
      setSaveErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const tabs: { id: CompanyTab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Profile & Legal", icon: <Building2 className="w-4 h-4" /> },
    { id: "address", label: "Address & Contact", icon: <MapPin className="w-4 h-4" /> },
    { id: "locale", label: "Locale & Fiscal Year", icon: <Globe className="w-4 h-4" /> },
    { id: "numbering", label: "Document Sequences", icon: <Hash className="w-4 h-4" /> },
    { id: "preferences", label: "Preferences & Tax", icon: <Sliders className="w-4 h-4" /> },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 pb-16">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-96 rounded-lg" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-8 text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
        <h3 className="text-base font-bold text-rose-900">{loadError}</h3>
        <Button size="sm" onClick={() => loadCompanyData()}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 max-w-5xl">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Company Setup & Profile
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Shield className="w-3 h-3" /> Tenant Root
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Configure legal entity details, official address, fiscal calendars, and document sequence numbering.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadCompanyData()}
            className="h-9 px-3 gap-1.5 text-xs text-slate-700 bg-white hover:bg-slate-50 border-slate-200"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload</span>
          </Button>

          {process.env.NODE_ENV !== "production" && (
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="text-xs font-mono font-medium text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors"
            >
              {showRawJson ? "Hide Raw JSON" : "Raw JSON"}
            </button>
          )}
        </div>
      </div>

      {/* Dev Mode Raw JSON Inspector */}
      {showRawJson && (
        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white overflow-hidden shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              Dev Mode Inspector: GET /api/v1/company
            </span>
          </div>
          <JsonViewer data={initialProfile} defaultExpanded={true} />
        </div>
      )}

      {/* Save Success / Error Banners */}
      {saveSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-800">
            <p className="font-semibold text-emerald-900">Changes Saved</p>
            <p className="mt-0.5">{saveSuccessMsg}</p>
          </div>
        </div>
      )}

      {saveErrorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800">
            <p className="font-semibold text-rose-900">Failed to Update</p>
            <p className="mt-0.5">{saveErrorMsg}</p>
          </div>
        </div>
      )}

      {/* Tabs Header */}
      <div className="flex border-b border-slate-200 overflow-x-auto space-x-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
                isActive
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Tabbed Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
          {/* TAB 1: Profile & Legal */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Profile & Legal Registration
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  General workspace display name, registered corporate name, and brand assets.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input
                  label="Display Brand / Company Name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Apex Solutions"
                  helperText="Name displayed on topbar, invoices, and customer emails."
                />

                <Input
                  label="Registered Legal Entity Name"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Apex Solutions Private Limited"
                  helperText="Full corporate name used for GST, VAT, and official contracts."
                />

                {/* Workspace Slug - STRICTLY READ ONLY */}
                <div>
                  <Input
                    label="Workspace URL Slug"
                    value={slug}
                    readOnly
                    disabled
                    helperText="Unique permanent workspace identifier (Read-only)."
                  />
                </div>

                <Input
                  label="Tax ID / GSTIN / VAT Registration"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value.toUpperCase())}
                  placeholder="24AABCA1234D1Z5"
                  helperText="Tax identifier included in standard invoices."
                />
              </div>

              {/* Logo URL with Live Preview */}
              <div className="pt-4 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-700 block mb-2">
                  Company Logo URL & Live Preview
                </label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* Live Thumbnail Preview */}
                  <div className="h-16 w-16 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                    {logoUrl && !logoBroken ? (
                      <Image
                        src={logoUrl}
                        alt="Logo preview"
                        width={64}
                        height={64}
                        unoptimized
                        className="h-full w-full object-contain p-1"
                        onError={() => setLogoBroken(true)}
                        onLoad={() => setLogoBroken(false)}
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 w-full">
                    <Input
                      value={logoUrl}
                      onChange={(e) => {
                        setLogoUrl(e.target.value);
                        setLogoBroken(false);
                      }}
                      placeholder="https://your-domain.com/assets/logo.png"
                      helperText="Direct public HTTPS image URL (PNG, SVG, JPG recommended)."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Address */}
          {activeTab === "address" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Head Office Registered Address & Contacts
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Primary corporate location printed on outgoing invoice headers and tax filings.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <Input
                    label="Address Line 1"
                    value={address.line1 || ""}
                    onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                    placeholder="Floor 4, Tech Park Tower, Building 2"
                  />
                </div>

                <div className="md:col-span-2">
                  <Input
                    label="Address Line 2 (Optional)"
                    value={address.line2 || ""}
                    onChange={(e) => setAddress({ ...address, line2: e.target.value })}
                    placeholder="SG Highway, Bodakdev"
                  />
                </div>

                <Input
                  label="City"
                  value={address.city || ""}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  placeholder="Ahmedabad"
                />

                <Input
                  label="State / Province"
                  value={address.state || ""}
                  onChange={(e) => setAddress({ ...address, state: e.target.value })}
                  placeholder="Gujarat"
                />

                <Input
                  label="Postal / PIN Code"
                  value={address.postalCode || ""}
                  onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                  placeholder="380054"
                />

                <Input
                  label="Country"
                  value={address.country || ""}
                  onChange={(e) => setAddress({ ...address, country: e.target.value })}
                  placeholder="India"
                />

                <Input
                  label="Primary Contact Phone"
                  value={address.phone || ""}
                  onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />

                <Input
                  label="Official Support / Billing Email"
                  type="email"
                  value={address.email || ""}
                  onChange={(e) => setAddress({ ...address, email: e.target.value })}
                  placeholder="billing@apexsolutions.in"
                />
              </div>
            </div>
          )}

          {/* TAB 3: Locale & Fiscal Year */}
          {activeTab === "locale" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Regional Locale & Fiscal Calendar
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure default currency, regional number format, operating timezone, and accounting year.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Select
                  label="Operating Timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  options={TIMEZONE_OPTIONS}
                  hint="All system timestamps and reports will align to this timezone."
                />

                <Select
                  label="Default Billing Currency"
                  value={defaultCurrency}
                  onChange={(e) => setDefaultCurrency(e.target.value)}
                  options={CURRENCY_OPTIONS}
                  hint="Primary currency symbol used across KPIs, orders, and statements."
                />

                <Select
                  label="Regional Format Locale"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  options={LOCALE_OPTIONS}
                  hint="Date format and number separator standards."
                />

                <Select
                  label="Accounting Fiscal Year"
                  value={financialYear}
                  onChange={(e) => setFinancialYear(e.target.value)}
                  options={FISCAL_YEAR_OPTIONS}
                  hint="Determines quarterly bounds and year-to-date reset boundaries."
                />
              </div>
            </div>
          )}

          {/* TAB 4: Numbering */}
          {activeTab === "numbering" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Document Auto-Sequencing
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Specify prefixes and starting counter numbers for auto-generated invoices, quotes, and orders.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Input
                  label="Invoice Number Prefix"
                  value={numbering.invoicePrefix || ""}
                  onChange={(e) => setNumbering({ ...numbering, invoicePrefix: e.target.value })}
                  placeholder="INV-"
                  helperText="e.g. INV-2026-1001"
                />

                <Input
                  label="Quotation Number Prefix"
                  value={numbering.quotationPrefix || ""}
                  onChange={(e) => setNumbering({ ...numbering, quotationPrefix: e.target.value })}
                  placeholder="QTN-"
                  helperText="e.g. QTN-0012"
                />

                <Input
                  label="Sales Order Prefix"
                  value={numbering.orderPrefix || ""}
                  onChange={(e) => setNumbering({ ...numbering, orderPrefix: e.target.value })}
                  placeholder="ORD-"
                  helperText="e.g. ORD-504"
                />

                <Input
                  label="Next Sequential Invoice Number"
                  type="number"
                  value={numbering.nextInvoiceNumber || 1001}
                  onChange={(e) =>
                    setNumbering({ ...numbering, nextInvoiceNumber: parseInt(e.target.value, 10) || 1 })
                  }
                  placeholder="1001"
                  helperText="Next generated invoice will use this number."
                />

                <div className="md:col-span-2 flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Reset Counter Annually</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Automatically restart document sequence counter back to 1 at the start of each new fiscal year.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(numbering.resetAnnually)}
                    onChange={(e) =>
                      setNumbering({ ...numbering, resetAnnually: e.target.checked })
                    }
                    className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Preferences */}
          {activeTab === "preferences" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Workspace Module Preferences & Taxes
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Control multi-branch behavior and default tax assessment percentages.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Enable Multi-Branch Operations</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Allow creating distinct physical branches, warehouse locations, and regional offices.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(modulePrefs.enableMultiBranch)}
                    onChange={(e) =>
                      setModulePrefs({ ...modulePrefs, enableMultiBranch: e.target.checked })
                    }
                    className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="max-w-xs">
                  <Input
                    label="Default Tax / GST Rate (%)"
                    type="number"
                    value={modulePrefs.defaultTaxRate || 18}
                    onChange={(e) =>
                      setModulePrefs({
                        ...modulePrefs,
                        defaultTaxRate: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="18"
                    helperText="Standard default tax percentage pre-filled on new line items."
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">
            * Only modified attributes will be dispatched to the backend API.
          </p>

          <Button
            type="submit"
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-6 py-2.5 rounded-xl shadow-xs gap-2"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Company Profile</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function CompanySettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-4">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      }
    >
      <CompanySettingsContent />
    </Suspense>
  );
}
