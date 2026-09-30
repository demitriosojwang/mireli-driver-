"use client";
// ─── Per-document upload form (wizard + re-upload share this) ───────────────
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOC_BY_KIND, IRA_UNDERWRITERS, UNREGISTERED_UNDERWRITER, DL_CLASSES } from "@/lib/onboarding/registry";
import type { DocKind, DriverRecord } from "@/lib/onboarding/types";
import type { DocPayload } from "@/lib/onboarding/store";
import { toast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";

interface FormState {
  docNumber: string;
  issuedAt: string;
  expiresAt: string;
  holderName: string;
  citizen: string;
  dlClass: string;
  psvEndorsed: string;
  adverse: string;
  underwriter: string;
  passengerCover: string;
  vehiclePlate: string;
  roadworthy: string;
  ownerName: string;
  leaseCertified: string;
}

const QUIRKS: Record<DocKind, { value: string; label: string }[]> = {
  id: [
    { value: "none", label: "No issue (clean check)" },
    { value: "mismatch", label: "Name differs from application" },
    { value: "badnum", label: "Malformed ID number" },
  ],
  dl: [
    { value: "none", label: "No issue (clean check)" },
    { value: "nopsv", label: "Missing PSV endorsement" },
    { value: "wrongclass", label: "Class A (boda) licence" },
    { value: "mismatch", label: "Holder name differs" },
    { value: "expired", label: "Already expired" },
  ],
  psv_badge: [
    { value: "none", label: "No issue (clean check)" },
    { value: "badnum", label: "Badge not in registry" },
    { value: "expired", label: "Already expired" },
  ],
  good_conduct: [
    { value: "none", label: "No issue (clean record)" },
    { value: "adverse", label: "Adverse criminal record" },
    { value: "expired", label: "Older than 12 months" },
  ],
  insurance: [
    { value: "none", label: "No issue (clean check)" },
    { value: "unknown", label: "Underwriter not IRA-registered" },
    { value: "nopax", label: "No passenger liability cover" },
    { value: "platewrong", label: "Insured plate mismatch" },
  ],
  inspection: [
    { value: "none", label: "No issue (passed)" },
    { value: "failed", label: "Failed roadworthiness" },
    { value: "platewrong", label: "Sticker plate mismatch" },
    { value: "expired", label: "Already expired" },
  ],
  ownership: [
    { value: "none", label: "No issue (clean check)" },
    { value: "otherowner", label: "Logbook in another name" },
    { value: "uncertified", label: "Lease not certified (hired)" },
  ],
};

function iso(n: number): string {
  const t = new Date();
  t.setDate(t.getDate() + n);
  return t.toISOString().slice(0, 10);
}

function initialState(kind: DocKind, driver: DriverRecord, existing?: DriverDocumentLike): FormState {
  const profile = driver.profile;
  const vehicle = driver.vehicle;
  const rnd = Math.floor(100000 + Math.random() * 899999);
  const base: FormState = {
    docNumber: "",
    issuedAt: "",
    expiresAt: "",
    holderName: profile.fullName,
    citizen: "true",
    dlClass: "B",
    psvEndorsed: "true",
    adverse: "false",
    underwriter: IRA_UNDERWRITERS[0],
    passengerCover: "true",
    vehiclePlate: vehicle?.plate ?? "",
    roadworthy: "true",
    ownerName: vehicle?.ownerType === "hired" ? vehicle?.ownerName ?? "" : profile.fullName,
    leaseCertified: "true",
  };
  switch (kind) {
    case "id":
      base.docNumber = profile.idNumber || String(Math.floor(20000000 + Math.random() * 79999999));
      base.expiresAt = "";
      break;
    case "dl":
      base.docNumber = `DL00${rnd}`;
      base.issuedAt = iso(-380);
      base.expiresAt = iso(545);
      break;
    case "psv_badge":
      base.docNumber = `PSV/B/${Math.floor(100000 + Math.random() * 899999)}`;
      base.issuedAt = iso(-160);
      base.expiresAt = iso(205);
      break;
    case "good_conduct":
      base.docNumber = `DCI/2026/${Math.floor(10000 + Math.random() * 89999)}`;
      base.issuedAt = iso(-25);
      base.expiresAt = iso(340);
      break;
    case "insurance":
      base.docNumber = `POL-JB-${Math.floor(100000 + Math.random() * 899999)}`;
      base.issuedAt = iso(-30);
      base.expiresAt = iso(335);
      break;
    case "inspection":
      base.docNumber = `MVIU/${Math.floor(100000 + Math.random() * 899999)}`;
      base.issuedAt = iso(-100);
      base.expiresAt = iso(265);
      break;
    case "ownership":
      base.docNumber =
        vehicle?.ownerType === "hired"
          ? `LEASE/${Math.floor(1000 + Math.random() * 8999)}`
          : `LOG-${(vehicle?.plate ?? "KAA000A").replace(/\s/g, "")}`;
      base.expiresAt = vehicle?.ownerType === "hired" ? iso(180) : "";
      break;
  }
  if (existing?.docNumber) {
    base.docNumber = existing.docNumber;
    base.issuedAt = existing.issuedAt?.slice(0, 10) ?? "";
    base.expiresAt = existing.expiresAt ? existing.expiresAt.slice(0, 10) : "";
    const m = existing.meta ?? {};
    if (m.holderName) base.holderName = m.holderName;
    if (m.citizen) base.citizen = m.citizen;
    if (m.dlClass) base.dlClass = m.dlClass;
    if (m.psvEndorsed) base.psvEndorsed = m.psvEndorsed;
    if (m.adverse) base.adverse = m.adverse;
    if (m.underwriter) base.underwriter = m.underwriter;
    if (m.passengerCover) base.passengerCover = m.passengerCover;
    if (m.vehiclePlate) base.vehiclePlate = m.vehiclePlate;
    if (m.roadworthy) base.roadworthy = m.roadworthy;
    if (m.ownerName) base.ownerName = m.ownerName;
    if (m.leaseCertified) base.leaseCertified = m.leaseCertified;
  }
  return base;
}

interface DriverDocumentLike {
  docNumber?: string;
  issuedAt?: string;
  expiresAt?: string | null;
  meta?: Record<string, string>;
}

export function DocForm({
  kind,
  driver,
  existing,
  onSave,
}: {
  kind: DocKind;
  driver: DriverRecord;
  existing?: DriverDocumentLike;
  onSave: (payload: DocPayload) => void;
}) {
  const req = DOC_BY_KIND[kind];
  const [form, setForm] = useState<FormState>(() => initialState(kind, driver, existing));
  const [quirk, setQuirk] = useState("none");
  const [attachment, setAttachment] = useState(existing?.meta ? "rescan_ready.jpg" : "");
  const isHired = driver.vehicle?.ownerType === "hired";
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const applyQuirk = (q: string) => {
    setQuirk(q);
    switch (q) {
      case "mismatch":
        set({ holderName: "Juma Ali Seif" });
        break;
      case "badnum":
        set({ docNumber: kind === "id" ? "12345" : "XX-01" });
        break;
      case "nopsv":
        set({ psvEndorsed: "false" });
        break;
      case "wrongclass":
        set({ dlClass: "A" });
        break;
      case "expired":
        set({ expiresAt: iso(-20) });
        break;
      case "adverse":
        set({ adverse: "true" });
        break;
      case "unknown":
        set({ underwriter: UNREGISTERED_UNDERWRITER });
        break;
      case "nopax":
        set({ passengerCover: "false" });
        break;
      case "platewrong":
        set({ vehiclePlate: "KAA 001A" });
        break;
      case "failed":
        set({ roadworthy: "false" });
        break;
      case "otherowner":
        set({ ownerName: "Harrison Mumba" });
        break;
      case "uncertified":
        set({ leaseCertified: "false" });
        break;
      default:
        set({ ...initialState(kind, driver, undefined) });
    }
  };

  const buildPayload = (): DocPayload | null => {
    if (!form.docNumber.trim()) {
      toast({ title: "Enter the document number" });
      return null;
    }
    if (kind !== "id" && !attachment) {
      toast({ title: "Attach a scan or photo first", description: "Tap the attach button to simulate capturing the document." });
      return null;
    }
    const meta: Record<string, string> = {};
    if (kind === "id") {
      meta.holderName = form.holderName;
      meta.citizen = form.citizen;
    } else if (kind === "dl") {
      meta.dlClass = form.dlClass;
      meta.psvEndorsed = form.psvEndorsed;
      meta.holderName = form.holderName;
    } else if (kind === "psv_badge") {
      meta.holderName = form.holderName;
    } else if (kind === "good_conduct") {
      meta.holderName = form.holderName;
      meta.adverse = form.adverse;
    } else if (kind === "insurance") {
      meta.underwriter = form.underwriter;
      meta.passengerCover = form.passengerCover;
      meta.vehiclePlate = form.vehiclePlate;
    } else if (kind === "inspection") {
      meta.roadworthy = form.roadworthy;
      meta.vehiclePlate = form.vehiclePlate;
    } else if (kind === "ownership") {
      meta.ownerName = form.ownerName;
      meta.leaseCertified = form.leaseCertified;
    }
    return {
      docNumber: form.docNumber.trim(),
      issuedAt: form.issuedAt || undefined,
      expiresAt: form.expiresAt ? form.expiresAt : null,
      meta,
      attachmentName: attachment || `${kind}_scan.jpg`,
    };
  };

  const sel = (label: string, value: string, onChange: (v: string) => void, options: { value: string; label: string }[]) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-500">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  const yesNo = [
    { value: "true", label: "Yes" },
    { value: "false", label: "No" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">Document number</Label>
          <Input className="h-9 font-mono text-sm" value={form.docNumber} onChange={(e) => set({ docNumber: e.target.value })} />
        </div>
        {kind !== "id" && !(kind === "ownership" && !isHired) && (
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Valid until</Label>
            <Input type="date" className="h-9 text-sm" value={form.expiresAt} onChange={(e) => set({ expiresAt: e.target.value })} />
          </div>
        )}
      </div>
      {kind === "id" && (
        <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-1">
          National IDs never expire — validity: Permanent.
        </p>
      )}
      {kind === "ownership" && !isHired && (
        <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-1">
          Logbook ownership is permanent — the lease validity window does not apply.
        </p>
      )}

      {kind === "id" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Holder name (as on ID)</Label>
            <Input className="h-9 text-sm" value={form.holderName} onChange={(e) => set({ holderName: e.target.value })} />
          </div>
          {sel("Kenyan citizen?", form.citizen, (v) => set({ citizen: v }), yesNo)}
        </div>
      )}
      {kind === "dl" && (
        <div className="grid grid-cols-2 gap-3">
          {sel("Licence class", form.dlClass, (v) => set({ dlClass: v }), DL_CLASSES)}
          {sel("PSV endorsement", form.psvEndorsed, (v) => set({ psvEndorsed: v }), yesNo)}
        </div>
      )}
      {(kind === "dl" || kind === "psv_badge" || kind === "good_conduct") && (
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">Holder name (as printed)</Label>
          <Input className="h-9 text-sm" value={form.holderName} onChange={(e) => set({ holderName: e.target.value })} />
        </div>
      )}
      {kind === "good_conduct" && sel("DCI search result", form.adverse, (v) => set({ adverse: v }), [
        { value: "false", label: "No adverse record" },
        { value: "true", label: "Adverse record found (demo)" },
      ])}
      {kind === "insurance" && (
        <>
          {sel("Underwriter (IRA register)", form.underwriter, (v) => set({ underwriter: v }),
            IRA_UNDERWRITERS.map((u) => ({ value: u, label: u })).concat([{ value: UNREGISTERED_UNDERWRITER, label: UNREGISTERED_UNDERWRITER }]))}
          <div className="grid grid-cols-2 gap-3">
            {sel("Passenger liability (PSV)", form.passengerCover, (v) => set({ passengerCover: v }), yesNo)}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Insured plate</Label>
              <Input className="h-9 font-mono text-sm uppercase" value={form.vehiclePlate} onChange={(e) => set({ vehiclePlate: e.target.value.toUpperCase() })} />
            </div>
          </div>
        </>
      )}
      {kind === "inspection" && (
        <div className="grid grid-cols-2 gap-3">
          {sel("Inspection result", form.roadworthy, (v) => set({ roadworthy: v }), [
            { value: "true", label: "Passed (governor, brakes, tyres, belts)" },
            { value: "false", label: "Failed (demo)" },
          ])}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Inspected plate</Label>
            <Input className="h-9 font-mono text-sm uppercase" value={form.vehiclePlate} onChange={(e) => set({ vehiclePlate: e.target.value.toUpperCase() })} />
          </div>
        </div>
      )}
      {kind === "ownership" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">{isHired ? "Lessor (legal owner)" : "Logbook owner"}</Label>
            <Input className="h-9 text-sm" value={form.ownerName} onChange={(e) => set({ ownerName: e.target.value })} />
          </div>
          {isHired && sel("Lease certified by Oaths?", form.leaseCertified, (v) => set({ leaseCertified: v }), yesNo)}
        </div>
      )}

      {/* attach simulation */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => {
            const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
            setAttachment(`${kind}_scan_${stamp}.jpg`);
            toast({ title: "Scan attached", description: `${req.short} captured (simulated camera scan)` });
          }}
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" /> Attach scan / photo
        </Button>
        {attachment && <span className="text-[11px] text-emerald-700 font-mono truncate">{attachment}</span>}
      </div>

      {/* demo quirk */}
      {sel("Demo: simulate an issue", quirk, applyQuirk, QUIRKS[kind])}

      <Button
        className="w-full h-10 bg-emerald-600 hover:bg-emerald-700"
        onClick={() => {
          const p = buildPayload();
          if (p) onSave(p);
        }}
      >
        Save {req.short}
      </Button>
    </div>
  );
}
