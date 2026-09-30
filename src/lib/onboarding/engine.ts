// ─── Automated Verification Engine (simulated government/insurer APIs) ──────
// Deterministic checks per document + cross-document consistency rules.
import type {
  ApiCallLog,
  DriverDocument,
  DriverProfile,
  VehicleInfo,
  DocKind,
} from "./types";
import { DOC_BY_KIND, ALLOWED_DL_CLASSES, IRA_UNDERWRITERS, UNREGISTERED_UNDERWRITER } from "./registry";

export interface CheckResult {
  outcome: "verified" | "failed" | "flagged";
  reason?: string;
  log: ApiCallLog;
}

let logSeq = 0;
const rid = () =>
  "req_" + Math.random().toString(36).slice(2, 8) + (logSeq++).toString(36);

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** every profile-name token must appear in the document name */
export function nameMatches(profileName: string, docName: string): boolean {
  const p = norm(profileName).split(" ").filter((t) => t.length > 1);
  const d = norm(docName);
  if (p.length === 0) return false;
  return p.every((tok) => d.includes(tok));
}

const idOk = (n: string) => /^\d{8}$/.test(n.trim()) || /^[A-Z]\d{7}$/.test(n.trim().toUpperCase());
const dlOk = (n: string) => /^(?:DL)?\d{6,10}$/i.test(n.trim());
const genericRefOk = (n: string) => /^[A-Z0-9/-]{5,24}$/i.test(n.trim());
const plateRefOk = (n: string) => genericRefOk(n.replace(/\s+/g, ""));

function isExpired(doc: DriverDocument, demoDate: Date): boolean {
  if (!doc.expiresAt) return false;
  return new Date(doc.expiresAt).getTime() < demoDate.getTime();
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

interface EngineCtx {
  profile: DriverProfile;
  vehicle?: VehicleInfo;
  documents: DriverDocument[];
  demoDate: Date;
}

/** Run the simulated registry check for one uploaded document. */
export function runCheck(kind: DocKind, doc: DriverDocument, ctx: EngineCtx): CheckResult {
  const req = DOC_BY_KIND[kind];
  const meta = doc.meta ?? {};
  const checks: { label: string; pass: boolean; detail: string }[] = [];
  const fail = (reason: string, httpStatus = 422): CheckResult => ({
    outcome: "failed",
    reason,
    log: mkLog(kind, req.api.name, req.api.endpoint, httpStatus, checks, "failed", reason),
  });
  const flag = (reason: string): CheckResult => ({
    outcome: "flagged",
    reason,
    log: mkLog(kind, req.api.name, req.api.endpoint, 200, checks, "flagged", reason),
  });
  const ok = (summary: string): CheckResult => ({
    outcome: "verified",
    log: mkLog(kind, req.api.name, req.api.endpoint, 200, checks, "verified", summary),
  });

  const expired = isExpired(doc, ctx.demoDate);
  if (expired) {
    checks.push({
      label: "Validity window",
      pass: false,
      detail: `Document expired on ${doc.expiresAt?.slice(0, 10)}`,
    });
    return fail(`Document expired on ${doc.expiresAt?.slice(0, 10)} — upload the renewed ${req.short}`);
  }

  switch (kind) {
    case "id": {
      const num = doc.docNumber ?? "";
      const goodFmt = idOk(num);
      checks.push({ label: "Number format (IPRS)", pass: goodFmt, detail: goodFmt ? `Valid ${num.startsWith("A") ? "passport" : "national ID"} format` : "Expected 8-digit national ID or A0000000 passport" });
      const name = nameMatches(ctx.profile.fullName, meta.holderName ?? ctx.profile.fullName);
      checks.push({ label: "Holder name vs application", pass: name, detail: name ? `${meta.holderName ?? ctx.profile.fullName} matches` : "Holder name differs from application" });
      const citizen = meta.citizen !== "false";
      checks.push({ label: "Citizenship / residency", pass: citizen, detail: citizen ? "Kenyan citizen confirmed" : "Residency status unresolved" });
      if (!goodFmt) return fail("ID number format not recognised by IPRS");
      if (!citizen) return fail("Identity record shows unresolved residency — manual verification required");
      if (!name) return flag(`ID holder name "${meta.holderName}" does not match application name "${ctx.profile.fullName}"`);
      return ok(`IPRS identity confirmed for ${meta.holderName ?? ctx.profile.fullName}`);
    }
    case "dl": {
      const num = doc.docNumber ?? "";
      const goodFmt = dlOk(num);
      checks.push({ label: "Licence number (TIMS)", pass: goodFmt, detail: goodFmt ? `DL ${num} located in TIMS` : "Number not found in TIMS" });
      const cls = meta.dlClass ?? "";
      const clsOk = (ALLOWED_DL_CLASSES as readonly string[]).includes(cls);
      checks.push({ label: "Licence class", pass: clsOk, detail: clsOk ? `Class ${cls} accepted (B / C / E)` : `Class ${cls || "—"} not accepted for feeder cabs` });
      const psv = meta.psvEndorsed === "true";
      checks.push({ label: "PSV endorsement", pass: psv, detail: psv ? "PSV endorsement active" : "No PSV endorsement on record" });
      const name = nameMatches(ctx.profile.fullName, meta.holderName ?? ctx.profile.fullName);
      checks.push({ label: "Licence name vs application", pass: name, detail: name ? "Name consistent" : "Licence holder differs from applicant" });
      if (!goodFmt) return fail("Driving licence number not found in NTSA TIMS");
      if (!clsOk) return fail(`Licence class ${cls || "unknown"} is not accepted — Class B / C / E required`);
      if (!psv) return fail("Licence lacks the PSV endorsement required to carry paying passengers");
      if (!name) return flag(`Licence holder "${meta.holderName}" differs from application name "${ctx.profile.fullName}"`);
      return ok(`TIMS licence valid — Class ${cls}, PSV endorsed, expires ${doc.expiresAt?.slice(0, 10) ?? "n/a"}`);
    }
    case "psv_badge": {
      const num = doc.docNumber ?? "";
      const goodFmt = genericRefOk(num);
      checks.push({ label: "Badge number (NTSA PSV)", pass: goodFmt, detail: goodFmt ? `Badge ${num} active in registry` : "Badge number not in registry" });
      const name = nameMatches(ctx.profile.fullName, meta.holderName ?? ctx.profile.fullName);
      checks.push({ label: "Badge holder vs application", pass: name, detail: name ? "Name consistent" : "Badge holder differs from applicant" });
      if (!goodFmt) return fail("PSV badge number not found in NTSA registry");
      if (!name) return flag(`Badge holder "${meta.holderName}" differs from application name`);
      return ok(`NTSA PSV badge ${num} valid until ${doc.expiresAt?.slice(0, 10) ?? "n/a"}`);
    }
    case "good_conduct": {
      const num = doc.docNumber ?? "";
      const goodFmt = genericRefOk(num);
      checks.push({ label: "DCI reference", pass: goodFmt, detail: goodFmt ? `Clearance ${num} located` : "Reference not recognised" });
      const adverse = meta.adverse === "true";
      checks.push({ label: "Criminal record search", pass: !adverse, detail: adverse ? "Adverse record found (violent / theft related)" : "No adverse record" });
      const name = nameMatches(ctx.profile.fullName, meta.holderName ?? ctx.profile.fullName);
      checks.push({ label: "Subject name vs application", pass: name, detail: name ? "Name consistent" : "Subject name differs from applicant" });
      if (!goodFmt) return fail("DCI clearance reference not recognised");
      if (adverse) return fail("Adverse criminal record — application rejected per safety policy 4.1");
      if (!name) return flag(`Clearance subject "${meta.holderName}" differs from application name`);
      return ok(`DCI clearance ${num} clean, issued within validity window`);
    }
    case "insurance": {
      const underwriter = meta.underwriter ?? "";
      const registered = IRA_UNDERWRITERS.includes(underwriter) && underwriter !== UNREGISTERED_UNDERWRITER;
      checks.push({ label: "Underwriter (IRA register)", pass: registered, detail: registered ? `${underwriter} is IRA-registered` : `${underwriter || "Unknown"} is NOT on the IRA register` });
      const paxCover = meta.passengerCover === "true";
      checks.push({ label: "Passenger liability (PSV)", pass: paxCover, detail: paxCover ? "Passenger bodily injury / death cover active" : "Policy lacks passenger liability cover" });
      const plate = norm(meta.vehiclePlate ?? "") === norm(ctx.vehicle?.plate ?? "");
      checks.push({ label: "Vehicle plate match", pass: plate, detail: plate ? `Policy covers ${meta.vehiclePlate}` : `Policy plate ${meta.vehiclePlate || "—"} ≠ ${ctx.vehicle?.plate ?? "—"}` });
      if (!registered) return fail(`${underwriter || "The underwriter"} is not IRA-registered — policy cannot be accepted`);
      if (!paxCover) return fail("Policy does not include PSV passenger liability — comprehensive PSV cover required");
      if (!plate) return flag(`Insured plate ${meta.vehiclePlate} does not match application vehicle ${ctx.vehicle?.plate}`);
      return ok(`Policy ${doc.docNumber} active — ${underwriter}, comprehensive PSV incl. passengers`);
    }
    case "inspection": {
      const num = doc.docNumber ?? "";
      const goodFmt = genericRefOk(num);
      checks.push({ label: "Sticker number (MVIU)", pass: goodFmt, detail: goodFmt ? `Sticker ${num} issued by MVIU` : "Sticker number not recognised" });
      const roadworthy = meta.roadworthy !== "false";
      checks.push({ label: "Roadworthiness result", pass: roadworthy, detail: roadworthy ? "Brakes, tyres, speed governor, seatbelts passed" : "Vehicle failed inspection items" });
      const plate = norm(meta.vehiclePlate ?? "") === norm(ctx.vehicle?.plate ?? "");
      checks.push({ label: "Vehicle plate match", pass: plate, detail: plate ? "Plate matches application" : "Plate mismatch" });
      if (!goodFmt) return fail("Inspection sticker not found in MVIU records");
      if (!roadworthy) return fail("Vehicle failed roadworthiness inspection — rectify and re-inspect");
      if (!plate) return flag(`Inspection plate ${meta.vehiclePlate} does not match application vehicle`);
      return ok(`MVIU sticker ${num} valid until ${doc.expiresAt?.slice(0, 10) ?? "n/a"}`);
    }
    case "ownership": {
      const isHired = ctx.vehicle?.ownerType === "hired";
      if (isHired) {
        const certified = meta.leaseCertified === "true";
        checks.push({ label: "Lease certification (Oaths)", pass: certified, detail: certified ? `Lease ${doc.docNumber} certified by Commissioner for Oaths` : "Lease agreement is not certified" });
        const lessor = (meta.ownerName ?? "").trim().length > 2;
        checks.push({ label: "Lessor identified", pass: lessor, detail: lessor ? `Legal owner: ${meta.ownerName}` : "Lessor name missing" });
        if (!certified) return fail("Lease agreement must be certified by a Commissioner for Oaths");
        if (!lessor) return fail("Lease does not identify the legal vehicle owner");
        return ok(`Certified lease ${doc.docNumber} — legal custody via ${meta.ownerName}`);
      }
      const name = nameMatches(ctx.profile.fullName, meta.ownerName ?? ctx.profile.fullName);
      checks.push({ label: "Logbook owner (TIMS)", pass: name, detail: name ? `Logbook registered to ${meta.ownerName}` : `Logbook owner "${meta.ownerName}" ≠ applicant` });
      const plate = plateRefOk(ctx.vehicle?.plate ?? "");
      checks.push({ label: "TIMS plate record", pass: plate, detail: plate ? `Plate ${ctx.vehicle?.plate} found in TIMS` : "Plate not found in TIMS" });
      if (!plate) return fail("Vehicle plate not found in TIMS ownership records");
      if (!name) return flag(`Logbook registered to "${meta.ownerName}" — attach a certified lease or transfer TIMS ownership`);
      return ok(`TIMS logbook confirms ${meta.ownerName} owns ${ctx.vehicle?.plate}`);
    }
  }
}

function mkLog(
  docKind: DocKind,
  api: string,
  endpoint: string,
  httpStatus: number,
  checks: ApiCallLog["checks"],
  outcome: ApiCallLog["outcome"],
  summary: string,
): ApiCallLog {
  return {
    id: rid(),
    docKind,
    api,
    endpoint,
    method: "POST",
    requestId: rid(),
    httpStatus,
    latencyMs: 240 + Math.floor(Math.random() * 900),
    at: new Date().toISOString(),
    checks,
    outcome,
    summary,
  };
}
