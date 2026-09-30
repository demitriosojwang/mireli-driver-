// ─── Seed data: demo drivers at every lifecycle stage ───────────────────────
import type { DriverDocument, DriverRecord, NotificationItem, AuditEntry, DocKind } from "./types";
import { DOCUMENT_REGISTRY, DOC_BY_KIND } from "./registry";
import { runCheck } from "./engine";

/** date-only ISO string offset by N days from today (N may be negative) */
export function d(n: number): string {
  const t = new Date();
  t.setDate(t.getDate() + n);
  return t.toISOString().slice(0, 10);
}
const nowIso = () => new Date().toISOString();

function blankDocs(): DriverDocument[] {
  return DOCUMENT_REGISTRY.map((r) => ({ kind: r.kind, status: "missing" as const }));
}

function setDoc(
  docs: DriverDocument[],
  kind: DocKind,
  data: Partial<DriverDocument> & { meta?: Record<string, string> },
): DriverDocument[] {
  const i = docs.findIndex((x) => x.kind === kind);
  if (i >= 0) docs[i] = { ...docs[i], ...data, status: data.status ?? "uploaded" };
  return docs;
}

/** run the simulated registry check and persist doc status + api log */
function autoVerify(
  docs: DriverDocument[],
  logs: DriverRecord["apiLogs"],
  kind: DocKind,
  profile: DriverRecord["profile"],
  vehicle: DriverRecord["vehicle"],
  demoDate = new Date(),
): void {
  const doc = docs.find((x) => x.kind === kind)!;
  const res = runCheck(kind, doc, { profile, vehicle, documents: docs, demoDate });
  doc.status = res.outcome === "verified" ? "verified" : res.outcome === "failed" ? "failed" : "flagged";
  doc.checkedAt = nowIso();
  if (res.reason) doc.flagReason = res.reason;
  if (res.outcome === "failed") doc.failureReason = res.reason;
  logs.push(res.log);
}

export function buildSeed(): {
  drivers: DriverRecord[];
  notifications: NotificationItem[];
  audit: AuditEntry[];
} {
  const drivers: DriverRecord[] = [];
  const notifications: NotificationItem[] = [];
  const audit: AuditEntry[] = [];
  const base = Date.now() - 45 * 86400000; // seeds created ~45 days ago

  // ── 1. Kevin Otieno — ACTIVE owner-driver, fully verified ──────────────────
  {
    const docs = blankDocs();
    const logs: DriverRecord["apiLogs"] = [];
    const profile = { fullName: "Kevin Otieno", phone: "+254722334455", email: "kevin.o@gmail.com", idNumber: "28471923", baseStage: "Likoni Ferry Stage" };
    const vehicle = { plate: "KDG 712J", model: "Suzuki Every (van)", seats: 6, ownerType: "owner" as const };
    setDoc(docs, "id", { docNumber: "28471923", meta: { holderName: "Kevin Otieno", citizen: "true" }, attachmentName: "id_scan.jpg" });
    setDoc(docs, "dl", { docNumber: "DL0092844", expiresAt: d(430), meta: { dlClass: "B", psvEndorsed: "true", holderName: "Kevin Otieno" }, attachmentName: "dl_front.jpg" });
    setDoc(docs, "psv_badge", { docNumber: "PSV/B/112394", expiresAt: d(240), meta: { holderName: "Kevin Otieno" }, attachmentName: "badge.jpg" });
    setDoc(docs, "good_conduct", { docNumber: "DCI/2025/77412", issuedAt: d(-75), expiresAt: d(290), meta: { holderName: "Kevin Otieno", adverse: "false" }, attachmentName: "good_conduct.pdf" });
    setDoc(docs, "insurance", { docNumber: "POL-JB-884120", issuedAt: d(-40), expiresAt: d(325), meta: { underwriter: "Jubilee Allianz Insurance", passengerCover: "true", vehiclePlate: "KDG 712J" }, attachmentName: "insurance_cert.pdf" });
    setDoc(docs, "inspection", { docNumber: "MVIU/712394", expiresAt: d(150), meta: { roadworthy: "true", vehiclePlate: "KDG 712J" }, attachmentName: "sticker.jpg" });
    setDoc(docs, "ownership", { docNumber: "LOG-KDG712J", meta: { ownerName: "Kevin Otieno", leaseCertified: "false" }, attachmentName: "logbook.jpg" });
    DOCUMENT_REGISTRY.forEach((r) => autoVerify(docs, logs, r.kind, profile, vehicle));
    drivers.push({
      id: "drv_kevin",
      profile,
      vehicle,
      status: "active",
      documents: docs,
      apiLogs: logs,
      flagReasons: [],
      createdAt: new Date(base).toISOString(),
      updatedAt: new Date(base + 86400000).toISOString(),
      submittedAt: new Date(base).toISOString(),
      verifiedAt: new Date(base + 3600000).toISOString(),
      activatedAt: new Date(base + 3 * 86400000).toISOString(),
      induction: { modulesDone: [0, 1, 2, 3], completedAt: new Date(base + 86400000).toISOString() },
      contract: { signedName: "Kevin Otieno", signedAt: new Date(base + 2 * 86400000).toISOString() },
    });
  }

  // ── 2. Faith Wambui — SUBMITTED, awaiting the automated verification run ───
  {
    const docs = blankDocs();
    const profile = { fullName: "Faith Wambui", phone: "+254733114477", email: "faith.w@yahoo.com", idNumber: "31298847", baseStage: "Diani Beach Stage" };
    const vehicle = { plate: "KDF 903M", model: "Toyota Hiace (matatu-style)", seats: 8, ownerType: "owner" as const };
    setDoc(docs, "id", { docNumber: "31298847", meta: { holderName: "Faith Wambui", citizen: "true" }, attachmentName: "id_scan.jpg" });
    setDoc(docs, "dl", { docNumber: "DL00873120", expiresAt: d(610), meta: { dlClass: "C", psvEndorsed: "true", holderName: "Faith Wambui" }, attachmentName: "dl_front.jpg" });
    setDoc(docs, "psv_badge", { docNumber: "PSV/C/118032", expiresAt: d(190), meta: { holderName: "Faith Wambui" }, attachmentName: "badge.jpg" });
    setDoc(docs, "good_conduct", { docNumber: "DCI/2026/11088", issuedAt: d(-20), expiresAt: d(345), meta: { holderName: "Faith Wambui", adverse: "false" }, attachmentName: "good_conduct.pdf" });
    setDoc(docs, "insurance", { docNumber: "POL-CIC-330217", issuedAt: d(-10), expiresAt: d(355), meta: { underwriter: "CIC Insurance Group", passengerCover: "true", vehiclePlate: "KDF 903M" }, attachmentName: "insurance_cert.pdf" });
    setDoc(docs, "inspection", { docNumber: "MVIU/903217", expiresAt: d(300), meta: { roadworthy: "true", vehiclePlate: "KDF 903M" }, attachmentName: "sticker.jpg" });
    setDoc(docs, "ownership", { docNumber: "LOG-KDF903M", meta: { ownerName: "Faith Wambui", leaseCertified: "false" }, attachmentName: "logbook.jpg" });
    drivers.push({
      id: "drv_faith",
      profile,
      vehicle,
      status: "submitted",
      documents: docs,
      apiLogs: [],
      flagReasons: [],
      createdAt: new Date(base + 10 * 86400000).toISOString(),
      updatedAt: nowIso(),
      submittedAt: nowIso(),
    });
  }

  // ── 3. John Mwangi — FLAGGED: name mismatch ID vs DL (admin review) ────────
  {
    const docs = blankDocs();
    const logs: DriverRecord["apiLogs"] = [];
    const profile = { fullName: "John Kamau Mwangi", phone: "+254701998822", email: "jkmwangi@gmail.com", idNumber: "22631094", baseStage: "Shelly Beach Stage" };
    const vehicle = { plate: "KDE 348B", model: "Nissan Caravan (van)", seats: 6, ownerType: "owner" as const };
    setDoc(docs, "id", { docNumber: "22631094", meta: { holderName: "John Kamau Mwangi", citizen: "true" }, attachmentName: "id_scan.jpg" });
    setDoc(docs, "dl", { docNumber: "DL00771845", expiresAt: d(220), meta: { dlClass: "B", psvEndorsed: "true", holderName: "John Mwangi" }, attachmentName: "dl_front.jpg" });
    setDoc(docs, "psv_badge", { docNumber: "PSV/B/109847", expiresAt: d(140), meta: { holderName: "John Kamau Mwangi" }, attachmentName: "badge.jpg" });
    setDoc(docs, "good_conduct", { docNumber: "DCI/2025/91233", issuedAt: d(-140), expiresAt: d(225), meta: { holderName: "John Kamau Mwangi", adverse: "false" }, attachmentName: "good_conduct.pdf" });
    setDoc(docs, "insurance", { docNumber: "POL-BM-114509", issuedAt: d(-60), expiresAt: d(305), meta: { underwriter: "Britam General Insurance", passengerCover: "true", vehiclePlate: "KDE 348B" }, attachmentName: "insurance_cert.pdf" });
    setDoc(docs, "inspection", { docNumber: "MVIU/348118", expiresAt: d(95), meta: { roadworthy: "true", vehiclePlate: "KDE 348B" }, attachmentName: "sticker.jpg" });
    setDoc(docs, "ownership", { docNumber: "LOG-KDE348B", meta: { ownerName: "John Kamau Mwangi", leaseCertified: "false" }, attachmentName: "logbook.jpg" });
    ["id", "dl", "psv_badge", "good_conduct", "insurance", "inspection", "ownership"].forEach((k) =>
      autoVerify(docs, logs, k as DocKind, profile, vehicle),
    );
    drivers.push({
      id: "drv_john",
      profile,
      vehicle,
      status: "flagged",
      documents: docs,
      apiLogs: logs,
      flagReasons: ["Driving licence holder name does not match the national ID"],
      createdAt: new Date(base + 18 * 86400000).toISOString(),
      updatedAt: new Date(base + 18 * 86400000 + 5400000).toISOString(),
      submittedAt: new Date(base + 18 * 86400000).toISOString(),
    });
    notifications.push({
      id: "n_john_flag",
      driverId: "drv_john",
      channel: "sms",
      title: "Verification on hold",
      body: "Msafiri: Your Driving Licence name (John Mwangi) differs from your ID (John Kamau Mwangi). A compliance officer will review your application within 24 hours.",
      at: new Date(base + 18 * 86400000 + 5400000).toISOString(),
    });
    audit.push({
      id: "a_john_flag",
      actor: "system",
      actorRole: "system",
      action: "auto.verify.flag",
      entity: "drv_john:dl",
      detail: "Licence holder name mismatch — routed to manual review",
      at: new Date(base + 18 * 86400000 + 5400000).toISOString(),
    });
  }

  // ── 4. Peter Njoroge — ACTIVE, Good Conduct expiring in 9 days ─────────────
  {
    const docs = blankDocs();
    const logs: DriverRecord["apiLogs"] = [];
    const profile = { fullName: "Peter Njoroge", phone: "+254711456789", email: "peter.n@outlook.com", idNumber: "19873456", baseStage: "Ukunda Stage" };
    const vehicle = { plate: "KDG 455T", model: "Nissan Caravan (van)", seats: 6, ownerType: "owner" as const };
    setDoc(docs, "id", { docNumber: "19873456", meta: { holderName: "Peter Njoroge", citizen: "true" }, attachmentName: "id_scan.jpg" });
    setDoc(docs, "dl", { docNumber: "DL00654102", expiresAt: d(365), meta: { dlClass: "E", psvEndorsed: "true", holderName: "Peter Njoroge" }, attachmentName: "dl_front.jpg" });
    setDoc(docs, "psv_badge", { docNumber: "PSV/E/104881", expiresAt: d(80), meta: { holderName: "Peter Njoroge" }, attachmentName: "badge.jpg" });
    setDoc(docs, "good_conduct", { docNumber: "DCI/2025/66021", issuedAt: d(-356), expiresAt: d(9), meta: { holderName: "Peter Njoroge", adverse: "false" }, attachmentName: "good_conduct.pdf" });
    setDoc(docs, "insurance", { docNumber: "POL-APA-502218", issuedAt: d(-200), expiresAt: d(165), meta: { underwriter: "APA Insurance", passengerCover: "true", vehiclePlate: "KDG 455T" }, attachmentName: "insurance_cert.pdf" });
    setDoc(docs, "inspection", { docNumber: "MVIU/455102", expiresAt: d(120), meta: { roadworthy: "true", vehiclePlate: "KDG 455T" }, attachmentName: "sticker.jpg" });
    setDoc(docs, "ownership", { docNumber: "LOG-KDG455T", meta: { ownerName: "Peter Njoroge", leaseCertified: "false" }, attachmentName: "logbook.jpg" });
    DOCUMENT_REGISTRY.forEach((r) => autoVerify(docs, logs, r.kind, profile, vehicle));
    drivers.push({
      id: "drv_peter",
      profile,
      vehicle,
      status: "active",
      documents: docs,
      apiLogs: logs,
      flagReasons: [],
      createdAt: new Date(base + 25 * 86400000).toISOString(),
      updatedAt: new Date(base + 26 * 86400000).toISOString(),
      submittedAt: new Date(base + 25 * 86400000).toISOString(),
      verifiedAt: new Date(base + 25 * 86400000 + 7200000).toISOString(),
      activatedAt: new Date(base + 28 * 86400000).toISOString(),
      induction: { modulesDone: [0, 1, 2, 3], completedAt: new Date(base + 26 * 86400000).toISOString() },
      contract: { signedName: "Peter Njoroge", signedAt: new Date(base + 27 * 86400000).toISOString() },
    });
    notifications.push({
      id: "n_peter_reminder",
      driverId: "drv_peter",
      channel: "sms",
      title: "Document expiring soon",
      body: "Msafiri: Your Certificate of Good Conduct expires in 9 days (renew at DCI for KES 1,000). Upload the new certificate before expiry to avoid automatic suspension.",
      at: new Date(base + 30 * 86400000).toISOString(),
    });
  }

  // ── 5. Samson Barasa — SUSPENDED: inspection sticker expired 12 days ago ───
  {
    const docs = blankDocs();
    const logs: DriverRecord["apiLogs"] = [];
    const profile = { fullName: "Samson Barasa", phone: "+254799887766", email: "s.barasa@gmail.com", idNumber: "30554127", baseStage: "Msambweni Stage" };
    const vehicle = { plate: "KCX 118R", model: "Toyota Probox (station wagon)", seats: 4, ownerType: "owner" as const };
    setDoc(docs, "id", { docNumber: "30554127", meta: { holderName: "Samson Barasa", citizen: "true" }, attachmentName: "id_scan.jpg" });
    setDoc(docs, "dl", { docNumber: "DL00712093", expiresAt: d(540), meta: { dlClass: "B", psvEndorsed: "true", holderName: "Samson Barasa" }, attachmentName: "dl_front.jpg" });
    setDoc(docs, "psv_badge", { docNumber: "PSV/B/113770", expiresAt: d(280), meta: { holderName: "Samson Barasa" }, attachmentName: "badge.jpg" });
    setDoc(docs, "good_conduct", { docNumber: "DCI/2025/80447", issuedAt: d(-110), expiresAt: d(255), meta: { holderName: "Samson Barasa", adverse: "false" }, attachmentName: "good_conduct.pdf" });
    setDoc(docs, "insurance", { docNumber: "POL-UAP-660833", issuedAt: d(-90), expiresAt: d(275), meta: { underwriter: "UAP Old Mutual", passengerCover: "true", vehiclePlate: "KCX 118R" }, attachmentName: "insurance_cert.pdf" });
    setDoc(docs, "inspection", { docNumber: "MVIU/118093", issuedAt: d(-377), expiresAt: d(-12), meta: { roadworthy: "true", vehiclePlate: "KCX 118R" }, attachmentName: "sticker.jpg" });
    setDoc(docs, "ownership", { docNumber: "LOG-KCX118R", meta: { ownerName: "Samson Barasa", leaseCertified: "false" }, attachmentName: "logbook.jpg" });
    DOCUMENT_REGISTRY.forEach((r) => autoVerify(docs, logs, r.kind, profile, vehicle));
    const insDoc = docs.find((x) => x.kind === "inspection")!;
    insDoc.status = "expired";
    insDoc.failureReason = "Inspection sticker expired on " + d(-12);
    drivers.push({
      id: "drv_samson",
      profile,
      vehicle,
      status: "suspended",
      documents: docs,
      apiLogs: logs,
      flagReasons: [],
      suspensionReason: "NTSA Inspection Sticker expired on " + d(-12),
      createdAt: new Date(base + 5 * 86400000).toISOString(),
      updatedAt: new Date(base + 33 * 86400000).toISOString(),
      submittedAt: new Date(base + 5 * 86400000).toISOString(),
      verifiedAt: new Date(base + 5 * 86400000 + 5400000).toISOString(),
      activatedAt: new Date(base + 8 * 86400000).toISOString(),
      suspendedAt: new Date(base + 33 * 86400000).toISOString(),
      induction: { modulesDone: [0, 1, 2, 3], completedAt: new Date(base + 6 * 86400000).toISOString() },
      contract: { signedName: "Samson Barasa", signedAt: new Date(base + 7 * 86400000).toISOString() },
    });
    notifications.push({
      id: "n_samson_susp",
      driverId: "drv_samson",
      channel: "sms",
      title: "Account suspended",
      body: "Msafiri: Your account has been suspended — NTSA Inspection Sticker expired on " + d(-12) + ". Book an inspection at any MVIU centre, then upload the new sticker to reactivate.",
      at: new Date(base + 33 * 86400000).toISOString(),
    });
    audit.push({
      id: "a_samson_susp",
      actor: "system",
      actorRole: "system",
      action: "compliance.auto_suspend",
      entity: "drv_samson",
      detail: "Inspection sticker lapsed — trips blocked pending renewal",
      at: new Date(base + 33 * 86400000).toISOString(),
    });
  }

  // ── 6. Grace Achieng — DRAFT: hired driver, 3 of 7 documents uploaded ──────
  {
    const docs = blankDocs();
    const profile = { fullName: "Grace Achieng", phone: "+254734556677", email: "grace.a@gmail.com", idNumber: "34128876", baseStage: "Pemba Pier Stage" };
    const vehicle = { plate: "KCA 271W", model: "Toyota TownAce (van)", seats: 5, ownerType: "hired" as const, ownerName: "Diana Muthoni" };
    setDoc(docs, "id", { docNumber: "34128876", meta: { holderName: "Grace Achieng", citizen: "true" }, attachmentName: "id_scan.jpg" });
    setDoc(docs, "dl", { docNumber: "DL00983371", expiresAt: d(700), meta: { dlClass: "B", psvEndorsed: "true", holderName: "Grace Achieng" }, attachmentName: "dl_front.jpg" });
    setDoc(docs, "good_conduct", { docNumber: "DCI/2026/09215", issuedAt: d(-30), expiresAt: d(335), meta: { holderName: "Grace Achieng", adverse: "false" }, attachmentName: "good_conduct.pdf" });
    drivers.push({
      id: "drv_grace",
      profile,
      vehicle,
      status: "draft",
      documents: docs,
      apiLogs: [],
      flagReasons: [],
      createdAt: new Date(base + 38 * 86400000).toISOString(),
      updatedAt: nowIso(),
    });
  }

  audit.push({
    id: "a_seed_boot",
    actor: "system",
    actorRole: "system",
    action: "seed.bootstrap",
    entity: "platform",
    detail: "6 demo drivers seeded across the onboarding lifecycle",
    at: nowIso(),
  });

  return { drivers, notifications, audit };
}

export { DOC_BY_KIND };
