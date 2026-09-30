"use client";
// ─── Shared UI bits + derived helpers ───────────────────────────────────────
import type { DocKind, DocStatus, DriverStatus } from "@/lib/onboarding/types";
import { useOnboarding } from "@/lib/onboarding/store";
import { Badge } from "@/components/ui/badge";

export const STATUS_META: Record<DriverStatus, { label: string; cls: string; dot: string }> = {
  draft: { label: "Draft", cls: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
  submitted: { label: "Submitted", cls: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  verifying: { label: "Verifying", cls: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500 animate-pulse" },
  action_required: { label: "Action required", cls: "bg-orange-50 text-orange-800 border-orange-200", dot: "bg-orange-500" },
  flagged: { label: "Flagged for review", cls: "bg-yellow-50 text-yellow-800 border-yellow-300", dot: "bg-yellow-500" },
  verified: { label: "KYD verified", cls: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  induction: { label: "In induction", cls: "bg-teal-50 text-teal-800 border-teal-200", dot: "bg-teal-500" },
  contract: { label: "Contract ready", cls: "bg-teal-50 text-teal-800 border-teal-200", dot: "bg-teal-500" },
  active: { label: "Active", cls: "bg-emerald-600 text-white border-emerald-600", dot: "bg-emerald-500" },
  suspended: { label: "Suspended", cls: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  rejected: { label: "Rejected", cls: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  deactivated: { label: "Deactivated", cls: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-400" },
};

export const DOC_STATUS_META: Record<DocStatus, { label: string; cls: string }> = {
  missing: { label: "Not uploaded", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  uploaded: { label: "Awaiting check", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  verifying: { label: "Checking…", cls: "bg-amber-50 text-amber-800 border-amber-200 animate-pulse" },
  verified: { label: "Verified", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  flagged: { label: "Flagged", cls: "bg-yellow-50 text-yellow-800 border-yellow-300" },
  failed: { label: "Failed", cls: "bg-red-50 text-red-700 border-red-200" },
  expired: { label: "Expired", cls: "bg-red-100 text-red-800 border-red-300" },
};

export function StatusBadge({ status }: { status: DriverStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function DocBadge({ status }: { status: DocStatus }) {
  const m = DOC_STATUS_META[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

export function daysLeft(expiresAt?: string | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}

export function ExpiryChip({ expiresAt }: { expiresAt?: string | null }) {
  const dl = daysLeft(expiresAt);
  if (dl === null) return <span className="text-[11px] text-slate-400">No expiry</span>;
  if (dl < 0) return <span className="text-[11px] font-semibold text-red-600">Expired {Math.abs(dl)}d ago</span>;
  if (dl <= 30) return <span className="text-[11px] font-semibold text-amber-600">{dl}d left</span>;
  return <span className="text-[11px] text-slate-500">{dl}d left</span>;
}

/** KYD gate progress across the 7 documents */
export function useKydProgress(driverId?: string) {
  const driver = useOnboarding((s) => s.drivers.find((d) => d.id === driverId));
  if (!driver) return { verified: 0, total: 7, pct: 0, missing: 7 };
  const verified = driver.documents.filter((x) => x.status === "verified").length;
  const missing = driver.documents.filter((x) => x.status === "missing").length;
  return { verified, total: 7, pct: Math.round((verified / 7) * 100), missing };
}

export function DocIcon({ kind, className = "h-4 w-4" }: { kind: DocKind; className?: string }) {
  const map: Record<DocKind, string> = {
    id: "🪪",
    dl: "🚗",
    psv_badge: "🎖️",
    good_conduct: "🛡️",
    insurance: "📑",
    inspection: "🔧",
    ownership: "📕",
  };
  return <span className={className} role="img" aria-label={kind}>{map[kind]}</span>;
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}
