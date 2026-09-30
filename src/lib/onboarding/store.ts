"use client";
// ─── Msafiri Onboarding Store ───────────────────────────────────────────────
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ApiCallLog,
  AuditEntry,
  BoardingSession,
  DriverDocument,
  DriverRecord,
  DocKind,
  NotificationItem,
  Session,
  VehicleInfo,
} from "./types";
import { DOCUMENT_REGISTRY, DOC_BY_KIND, ADMIN_EMAILS, ADMIN_2FA_CODE, PASSENGER_POOL } from "./registry";
import { runCheck } from "./engine";
import { buildSeed } from "./seed";

export interface DocPayload {
  docNumber: string;
  issuedAt?: string;
  expiresAt?: string | null;
  meta: Record<string, string>;
  attachmentName?: string;
}

interface LoginResult {
  ok: boolean;
  role?: "driver" | "admin";
  needs2FA?: boolean;
  message?: string;
}

interface OnboardingState {
  session: Session | null;
  drivers: DriverRecord[];
  notifications: NotificationItem[];
  audit: AuditEntry[];
  boarding: BoardingSession | null;
  remindersSent: string[];
  demoDayOffset: number;
  pendingAdminId: string | null;

  // auth
  login: (identifier: string) => LoginResult;
  verifyAdmin2FA: (code: string) => boolean;
  logout: () => void;

  // driver application
  upsertProfile: (patch: Partial<DriverRecord["profile"]>) => void;
  upsertVehicle: (patch: Partial<VehicleInfo>) => void;
  saveDocument: (kind: DocKind, payload: DocPayload) => void;
  submitApplication: () => void;
  verifyDocument: (driverId: string, kind: DocKind) => void;
  finalizeVerification: (driverId: string) => void;
  reuploadDocument: (kind: DocKind, payload: DocPayload) => void;

  // lifecycle
  beginInduction: () => void;
  passInductionModule: (idx: number) => void;
  signContract: (name: string) => void;

  // boarding PIN
  requestBoarding: () => void;
  submitPin: (pin: string) => "ok" | "wrong" | "locked" | "none";
  clearBoarding: () => void;

  // admin
  reviewDocument: (driverId: string, kind: DocKind, decision: "approve" | "reupload", note: string) => void;
  rejectApplication: (driverId: string, reason: string) => void;
  forceReactivate: (driverId: string) => void;
  sendReminderNow: (driverId: string, kind: DocKind) => void;
  advanceClock: (days: number) => void;
  resetClock: () => void;

  // system
  sweep: () => void;
  resetAll: () => void;
}

const nowIso = () => new Date().toISOString();
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

function blankDocs(): DriverDocument[] {
  return DOCUMENT_REGISTRY.map((r) => ({ kind: r.kind, status: "missing" as const }));
}

function notify(item: { driverId?: string; channel?: "app" | "sms"; title: string; body: string }) {
  useOnboarding.setState((s) => ({
    notifications: [{ id: uid("n"), channel: item.channel ?? "app", at: nowIso(), ...item }, ...s.notifications],
  }));
}

function logAudit(e: { actor: string; actorRole: "driver" | "admin" | "system"; action: string; entity: string; detail?: string }) {
  useOnboarding.setState((s) => ({
    audit: [{ id: uid("a"), at: nowIso(), ...e }, ...s.audit],
  }));
}

// fresh demo world for first boot (persisted state overrides this on return visits)
const initialSeed = buildSeed();

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set, get) => ({
      session: null,
      drivers: initialSeed.drivers,
      notifications: initialSeed.notifications,
      audit: initialSeed.audit,
      boarding: null,
      remindersSent: [],
      demoDayOffset: 0,
      pendingAdminId: null,

      // ── auth ──────────────────────────────────────────────────────────────
      login: (identifier) => {
        const id = identifier.trim();
        const email = id.toLowerCase();
        if (ADMIN_EMAILS.includes(email)) {
          set({ pendingAdminId: id });
          return { ok: true, role: "admin", needs2FA: true };
        }
        const st = get();
        const known = st.drivers.find(
          (d) => d.profile.phone === id || (d.profile.email ?? "").toLowerCase() === email,
        );
        if (known) {
          set({
            session: { role: "driver", identifier: id, name: known.profile.fullName, driverId: known.id, at: nowIso() },
            boarding: null,
          });
          logAudit({ actor: id, actorRole: "driver", action: "auth.login", entity: known.id });
          get().sweep();
          return { ok: true, role: "driver" };
        }
        // brand-new applicant → create draft
        const newDriver: DriverRecord = {
          id: uid("drv"),
          profile: { fullName: "New Driver", phone: id, email: id.includes("@") ? id : undefined },
          status: "draft",
          documents: blankDocs(),
          apiLogs: [],
          flagReasons: [],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set({ drivers: [...get().drivers, newDriver] });
        set({
          session: { role: "driver", identifier: id, name: newDriver.profile.fullName, driverId: newDriver.id, at: nowIso() },
        });
        logAudit({ actor: id, actorRole: "driver", action: "onboarding.start", entity: newDriver.id });
        return { ok: true, role: "driver" };
      },

      verifyAdmin2FA: (code) => {
        if (code.trim() !== ADMIN_2FA_CODE) return false;
        const id = get().pendingAdminId ?? "admin";
        set({
          session: { role: "admin", identifier: id, name: "Demitri (Admin)", at: nowIso() },
          pendingAdminId: null,
        });
        logAudit({ actor: id, actorRole: "admin", action: "auth.login.2fa", entity: "admin_console" });
        return true;
      },

      logout: () => set({ session: null, boarding: null }),

      // ── driver application ────────────────────────────────────────────────
      upsertProfile: (patch) => {
        const { session } = get();
        if (!session?.driverId) return;
        set({
          drivers: get().drivers.map((d) =>
            d.id === session.driverId
              ? { ...d, profile: { ...d.profile, ...patch }, updatedAt: nowIso() }
              : d,
          ),
        });
      },

      upsertVehicle: (patch) => {
        const { session } = get();
        if (!session?.driverId) return;
        set({
          drivers: get().drivers.map((d) =>
            d.id === session.driverId
              ? { ...d, vehicle: { plate: "", model: "", seats: 4, ownerType: "owner" as const, ...d.vehicle, ...patch }, updatedAt: nowIso() }
              : d,
          ),
        });
      },

      saveDocument: (kind, payload) => {
        const { session } = get();
        if (!session?.driverId) return;
        set({
          drivers: get().drivers.map((d) => {
            if (d.id !== session.driverId) return d;
            return {
              ...d,
              updatedAt: nowIso(),
              documents: d.documents.map((x) =>
                x.kind === kind
                  ? {
                      ...x,
                      status: "uploaded" as const,
                      docNumber: payload.docNumber,
                      issuedAt: payload.issuedAt,
                      expiresAt: payload.expiresAt ?? null,
                      meta: payload.meta,
                      attachmentName: payload.attachmentName ?? `${DOC_BY_KIND[kind].kind}_scan.jpg`,
                      failureReason: undefined,
                      flagReason: undefined,
                      adminNote: undefined,
                    }
                  : x,
              ),
            };
          }),
        });
        logAudit({ actor: session.identifier, actorRole: "driver", action: "document.upload", entity: `${session.driverId}:${kind}` });
      },

      submitApplication: () => {
        const { session } = get();
        if (!session?.driverId) return;
        const drv = get().drivers.find((d) => d.id === session.driverId);
        if (!drv) return;
        set({
          drivers: get().drivers.map((d) =>
            d.id === session.driverId ? { ...d, status: "submitted" as const, submittedAt: nowIso(), updatedAt: nowIso() } : d,
          ),
        });
        notify({
          driverId: session.driverId,
          channel: "sms",
          title: "Application received",
          body: `Msafiri: Karibu ${drv.profile.fullName}! We are now verifying your 7 documents against NTSA, eCitizen, DCI and IRA registries. You will get results shortly.`,
        });
        notify({
          title: "New application",
          body: `${drv.profile.fullName} (${drv.vehicle?.plate ?? "no vehicle"}) submitted all 7 KYD documents for automated verification.`,
        });
        logAudit({ actor: session.identifier, actorRole: "driver", action: "onboarding.submit", entity: session.driverId });
      },

      verifyDocument: (driverId, kind) => {
        const st = get();
        const drv = st.drivers.find((d) => d.id === driverId);
        if (!drv) return;
        const doc = drv.documents.find((x) => x.kind === kind);
        if (!doc || (doc.status !== "uploaded" && doc.status !== "missing")) return;
        // mark verifying
        set({
          drivers: st.drivers.map((d) =>
            d.id === driverId
              ? { ...d, documents: d.documents.map((x) => (x.kind === kind ? { ...x, status: "verifying" as const } : x)) }
              : d,
          ),
        });
        const res = runCheck(kind, doc, {
          profile: drv.profile,
          vehicle: drv.vehicle,
          documents: drv.documents,
          demoDate: new Date(Date.now() + st.demoDayOffset * 86400000),
        });
        set({
          drivers: get().drivers.map((d) => {
            if (d.id !== driverId) return d;
            const logs: ApiCallLog[] = [
              res.log,
              ...d.apiLogs,
            ];
            return {
              ...d,
              updatedAt: nowIso(),
              apiLogs: logs,
              documents: d.documents.map((x) =>
                x.kind === kind
                  ? {
                      ...x,
                      status: res.outcome === "verified" ? ("verified" as const) : res.outcome === "failed" ? ("failed" as const) : ("flagged" as const),
                      checkedAt: nowIso(),
                      failureReason: res.outcome === "failed" ? res.reason : undefined,
                      flagReason: res.outcome === "flagged" ? res.reason : undefined,
                    }
                  : x,
              ),
            };
          }),
        });
        logAudit({
          actor: "system",
          actorRole: "system",
          action: `auto.verify.${res.outcome}`,
          entity: `${driverId}:${kind}`,
          detail: res.reason ?? res.log.summary,
        });
        // all 7 processed → advance the state machine (store-owned, survives unmounts)
        const after = get().drivers.find((d) => d.id === driverId);
        if (after && after.documents.every((x) => ["verified", "failed", "flagged", "expired"].includes(x.status))) {
          get().finalizeVerification(driverId);
        }
      },

      finalizeVerification: (driverId) => {
        const st = get();
        const drv = st.drivers.find((d) => d.id === driverId);
        if (!drv) return;
        const docs = drv.documents;
        const anyFailed = docs.some((x) => x.status === "failed");
        const anyFlagged = docs.some((x) => x.status === "flagged");
        const allVerified = docs.every((x) => x.status === "verified");
        let next: DriverRecord["status"] = drv.status;
        if (drv.status === "suspended") {
          // reactivation path: all 7 valid again → back to active automatically
          if (allVerified) {
            set({
              drivers: get().drivers.map((d) =>
                d.id === driverId
                  ? { ...d, status: "active" as const, suspensionReason: undefined, suspendedAt: undefined, updatedAt: nowIso() }
                  : d,
              ),
            });
            notify({
              driverId,
              channel: "sms",
              title: "Account reactivated",
              body: "Msafiri: All documents valid again — you are back on the road. Karibu tena!",
            });
            logAudit({ actor: "system", actorRole: "system", action: "compliance.auto_reactivate", entity: driverId, detail: "Renewals verified after suspension" });
            return;
          }
          return; // stay suspended until every document clears
        }
        if (allVerified) next = "verified";
        else if (anyFailed) next = "action_required";
        else if (anyFlagged) next = "flagged";
        if (next === drv.status) return;
        set({
          drivers: get().drivers.map((d) =>
            d.id === driverId ? { ...d, status: next, verifiedAt: next === "verified" ? nowIso() : d.verifiedAt, updatedAt: nowIso() } : d,
          ),
        });
        if (next === "verified") {
          notify({
            driverId,
            channel: "sms",
            title: "7-Point KYD Gate passed",
            body: "Msafiri: All 7 documents verified. Next step — complete your 4 induction modules, then sign the platform agreement to go live.",
          });
          notify({
            title: "Application verified",
            body: `${drv.profile.fullName} passed the 7-Point KYD Gate automatically. Awaiting induction.`,
          });
        } else if (next === "flagged") {
          notify({
            driverId,
            channel: "sms",
            title: "Verification on hold",
            body: "Msafiri: Some documents need a compliance officer's review. We will contact you within 24 hours.",
          });
          notify({
            title: "Manual review needed",
            body: `${drv.profile.fullName}: ${docs.filter((x) => x.status === "flagged").map((x) => DOC_BY_KIND[x.kind].short).join(", ")} flagged by automated checks.`,
          });
        } else if (next === "action_required") {
          const failed = docs.filter((x) => x.status === "failed");
          notify({
            driverId,
            channel: "sms",
            title: "Action required",
            body: `Msafiri: ${failed.map((x) => DOC_BY_KIND[x.kind].short).join(", ")} failed verification. Open the app to see reasons and re-upload.`,
          });
        }
      },

      reuploadDocument: (kind, payload) => {
        const { session } = get();
        if (!session?.driverId) return;
        get().saveDocument(kind, payload);
        const driverId = session.driverId;
        set({
          drivers: get().drivers.map((d) =>
            d.id === driverId
              ? {
                  ...d,
                  updatedAt: nowIso(),
                  status: d.status === "suspended" ? "suspended" : "submitted",
                  documents: d.documents.map((x) => (x.kind === kind ? { ...x, reuploadCount: (x.reuploadCount ?? 0) + 1 } : x)),
                }
              : d,
          ),
        });
        logAudit({ actor: session.identifier, actorRole: "driver", action: "document.reupload", entity: `${driverId}:${kind}` });
      },

      // ── lifecycle ─────────────────────────────────────────────────────────
      beginInduction: () => {
        const { session } = get();
        if (!session?.driverId) return;
        set({
          drivers: get().drivers.map((d) =>
            d.id === session.driverId ? { ...d, status: "induction" as const, induction: d.induction ?? { modulesDone: [] }, updatedAt: nowIso() } : d,
          ),
        });
        logAudit({ actor: session.identifier, actorRole: "driver", action: "induction.begin", entity: session.driverId });
      },

      passInductionModule: (idx) => {
        const { session } = get();
        if (!session?.driverId) return;
        const drv = get().drivers.find((d) => d.id === session.driverId);
        if (!drv) return;
        const done = Array.from(new Set([...(drv.induction?.modulesDone ?? []), idx]));
        const completed = done.length === 4;
        set({
          drivers: get().drivers.map((d) =>
            d.id === session.driverId
              ? {
                  ...d,
                  induction: { modulesDone: done, completedAt: completed ? nowIso() : undefined },
                  status: completed ? ("contract" as const) : "induction",
                  updatedAt: nowIso(),
                }
              : d,
          ),
        });
        if (completed) {
          notify({
            driverId: session.driverId,
            title: "Induction complete",
            body: "Msafiri: Asante! You passed all 4 induction modules. Last step — review and sign the platform agreement.",
          });
          logAudit({ actor: session.identifier, actorRole: "driver", action: "induction.complete", entity: session.driverId });
        }
      },

      signContract: (name) => {
        const { session } = get();
        if (!session?.driverId) return;
        const drv = get().drivers.find((d) => d.id === session.driverId);
        if (!drv) return;
        set({
          drivers: get().drivers.map((d) =>
            d.id === session.driverId
              ? { ...d, status: "active" as const, activatedAt: nowIso(), updatedAt: nowIso(), contract: { signedName: name, signedAt: nowIso() } }
              : d,
          ),
        });
        notify({
          driverId: session.driverId,
          channel: "sms",
          title: "You are live",
          body: `Msafiri: Karibu onboard, ${name}! Your cab is now visible to passengers. Remember: never start a trip without the passenger's 4-digit boarding PIN.`,
        });
        notify({
          title: "Driver activated",
          body: `${drv.profile.fullName} (${drv.vehicle?.plate}) signed the agreement and is now taking trips.`,
        });
        logAudit({ actor: session.identifier, actorRole: "driver", action: "contract.sign", entity: session.driverId, detail: `Signed as ${name}` });
      },

      // ── boarding PIN ──────────────────────────────────────────────────────
      requestBoarding: () => {
        const { session } = get();
        if (!session?.driverId) return;
        const drv = get().drivers.find((d) => d.id === session.driverId);
        if (!drv || drv.status !== "active") return;
        const p = PASSENGER_POOL[Math.floor(Math.random() * PASSENGER_POOL.length)];
        const pin = String(Math.floor(1000 + Math.random() * 9000));
        const bs: BoardingSession = {
          id: uid("board"),
          driverId: session.driverId,
          passengerName: p.name,
          stage: p.stage,
          seats: 1 + Math.floor(Math.random() * 3),
          pin,
          attempts: 0,
          state: "awaiting_pin",
          createdAt: nowIso(),
        };
        set({ boarding: bs });
        logAudit({ actor: session.identifier, actorRole: "driver", action: "boarding.request", entity: bs.id, detail: `${p.name} @ ${p.stage}` });
      },

      submitPin: (pin) => {
        const { session, boarding } = get();
        if (!session?.driverId || !boarding) return "none";
        if (boarding.state !== "awaiting_pin") return "none";
        if (pin.trim() === boarding.pin) {
          set({
            boarding: { ...boarding, state: "boarding_ok", verifiedAt: nowIso() },
          });
          logAudit({ actor: session.identifier, actorRole: "driver", action: "boarding.pin_ok", entity: boarding.id, detail: `Trip started for ${boarding.passengerName}` });
          return "ok";
        }
        const attempts = boarding.attempts + 1;
        const locked = attempts >= 3;
        set({
          boarding: { ...boarding, attempts, state: locked ? "failed" : "awaiting_pin" },
        });
        logAudit({ actor: session.identifier, actorRole: "driver", action: locked ? "boarding.locked" : "boarding.pin_wrong", entity: boarding.id, detail: `Attempt ${attempts}` });
        if (locked) {
          notify({
            driverId: session.driverId,
            title: "Boarding locked",
            body: "Msafiri: 3 wrong PIN entries. For passenger safety this booking is locked — contact support to release it. Impostor-pickup attempts are audited.",
          });
        }
        return locked ? "locked" : "wrong";
      },

      clearBoarding: () => set({ boarding: null }),

      // ── admin ─────────────────────────────────────────────────────────────
      reviewDocument: (driverId, kind, decision, note) => {
        const { session } = get();
        set({
          drivers: get().drivers.map((d) => {
            if (d.id !== driverId) return d;
            return {
              ...d,
              updatedAt: nowIso(),
              documents: d.documents.map((x) =>
                x.kind === kind
                  ? decision === "approve"
                    ? { ...x, status: "verified" as const, flagReason: undefined, adminNote: note || "Manually approved by compliance" }
                    : { ...x, status: "failed" as const, flagReason: undefined, adminNote: note || "Re-upload requested", failureReason: note || "Re-upload requested by compliance" }
                  : x,
              ),
            };
          }),
        });
        if (decision === "reupload") {
          notify({
            driverId,
            channel: "sms",
            title: "Re-upload requested",
            body: `Msafiri: Compliance needs a clearer ${DOC_BY_KIND[kind].short}. ${note || "Please re-upload."}`,
          });
        }
        logAudit({ actor: session?.identifier ?? "admin", actorRole: "admin", action: `review.${decision}`, entity: `${driverId}:${kind}`, detail: note });
        // recompute application status
        const drv = get().drivers.find((d) => d.id === driverId);
        if (!drv) return;
        const anyFailed = drv.documents.some((x) => x.status === "failed");
        const anyFlagged = drv.documents.some((x) => x.status === "flagged");
        const allVerified = drv.documents.every((x) => x.status === "verified");
        const inFlight = ["submitted", "action_required", "flagged", "verifying"].includes(drv.status);
        if (inFlight) {
          const next = allVerified ? "verified" : anyFailed ? "action_required" : anyFlagged ? "flagged" : drv.status;
          if (next !== drv.status) {
            set({ drivers: get().drivers.map((d) => (d.id === driverId ? { ...d, status: next, updatedAt: nowIso() } : d)) });
          }
        }
      },

      rejectApplication: (driverId, reason) => {
        const drv = get().drivers.find((d) => d.id === driverId);
        if (!drv) return;
        set({
          drivers: get().drivers.map((d) => (d.id === driverId ? { ...d, status: "rejected" as const, rejectionReason: reason, updatedAt: nowIso() } : d)),
        });
        notify({
          driverId,
          channel: "sms",
          title: "Application declined",
          body: `Msafiri: Your application was declined. Reason: ${reason}. Contact support to appeal.`,
        });
        logAudit({ actor: get().session?.identifier ?? "admin", actorRole: "admin", action: "application.reject", entity: driverId, detail: reason });
      },

      forceReactivate: (driverId) => {
        const drv = get().drivers.find((d) => d.id === driverId);
        if (!drv || drv.status !== "suspended") return;
        set({
          drivers: get().drivers.map((d) =>
            d.id === driverId ? { ...d, status: "active" as const, suspensionReason: undefined, suspendedAt: undefined, updatedAt: nowIso() } : d,
          ),
        });
        notify({ driverId, title: "Account reactivated", body: "Msafiri: Your account is active again. Karibu tena!" });
        logAudit({ actor: get().session?.identifier ?? "admin", actorRole: "admin", action: "compliance.reactivate", entity: driverId, detail: "Manual override by compliance" });
      },

      sendReminderNow: (driverId, kind) => {
        const drv = get().drivers.find((d) => d.id === driverId);
        if (!drv) return;
        const doc = drv.documents.find((x) => x.kind === kind);
        const days = doc?.expiresAt ? Math.ceil((new Date(doc.expiresAt).getTime() - Date.now()) / 86400000) : null;
        notify({
          driverId,
          channel: "sms",
          title: "Renewal reminder sent",
          body: `Msafiri: Your ${DOC_BY_KIND[kind].short} ${days !== null && days >= 0 ? `expires in ${days} day(s)` : "has expired"}. Renew with ${DOC_BY_KIND[kind].authority} and upload the new document.`,
        });
        logAudit({ actor: get().session?.identifier ?? "admin", actorRole: "admin", action: "compliance.remind", entity: `${driverId}:${kind}` });
      },

      advanceClock: (days) => {
        set({ demoDayOffset: get().demoDayOffset + days });
        logAudit({ actor: get().session?.identifier ?? "admin", actorRole: "admin", action: "demo.clock", entity: "platform", detail: `+${days} days → offset ${get().demoDayOffset}` });
        get().sweep();
      },

      resetClock: () => {
        set({ demoDayOffset: 0 });
        get().sweep();
      },

      // ── system: expiry enforcement + reminders ────────────────────────────
      sweep: () => {
        const st = get();
        const demoNow = Date.now() + st.demoDayOffset * 86400000;
        const sent = new Set(st.remindersSent);
        const drivers = st.drivers.map((d) => {
          if (!["active", "verified", "induction", "contract"].includes(d.status)) return d;
          const docs = d.documents.map((x) => {
            if (x.status === "verified" && x.expiresAt && new Date(x.expiresAt).getTime() < demoNow) {
              return { ...x, status: "expired" as const };
            }
            return x;
          });
          // reminders at 14 / 7 / 1 days for active drivers
          if (d.status === "active") {
            docs.forEach((x) => {
              if (!x.expiresAt || x.status !== "verified") return;
              const daysLeft = Math.ceil((new Date(x.expiresAt).getTime() - demoNow) / 86400000);
              [14, 7, 1].forEach((t) => {
                if (daysLeft === t || (daysLeft < t && daysLeft >= 0 && !sent.has(`${d.id}:${x.kind}:${t}`))) {
                  const key = `${d.id}:${x.kind}:${t}`;
                  if (!sent.has(key)) {
                    sent.add(key);
                    notify({
                      driverId: d.id,
                      channel: "sms",
                      title: t === 1 ? "Expires tomorrow" : "Renewal reminder",
                      body: `Msafiri: Your ${DOC_BY_KIND[x.kind].short} expires in ${daysLeft} day(s). Renew with ${DOC_BY_KIND[x.kind].authority} and upload it in-app to avoid suspension.`,
                    });
                  }
                }
              });
            });
          }
          const expired = docs.filter((x) => x.status === "expired");
          if (expired.length > 0 && d.status === "active") {
            notify({
              driverId: d.id,
              channel: "sms",
              title: "Account suspended",
              body: `Msafiri: ${expired.map((x) => DOC_BY_KIND[x.kind].short).join(", ")} expired. Trips are blocked until you upload valid renewals.`,
            });
            logAudit({
              actor: "system",
              actorRole: "system",
              action: "compliance.auto_suspend",
              entity: d.id,
              detail: expired.map((x) => x.kind).join(", ") + " lapsed",
            });
            notify({
              title: "Auto-suspension",
              body: `${d.profile.fullName} (${d.vehicle?.plate}) auto-suspended — ${expired.map((x) => DOC_BY_KIND[x.kind].short).join(", ")} expired.`,
            });
            return { ...d, status: "suspended" as const, suspensionReason: `${expired.map((x) => DOC_BY_KIND[x.kind].short).join(", ")} expired`, suspendedAt: nowIso(), documents: docs, updatedAt: nowIso() };
          }
          if (expired.length > 0 && ["verified", "induction", "contract"].includes(d.status)) {
            return { ...d, status: "action_required" as const, documents: docs, updatedAt: nowIso() };
          }
          return { ...d, documents: docs };
        });
        set({ drivers, remindersSent: Array.from(sent) });
      },

      resetAll: () => {
        const seed = buildSeed();
        set({
          drivers: seed.drivers,
          notifications: seed.notifications,
          audit: seed.audit,
          boarding: null,
          remindersSent: [],
          demoDayOffset: 0,
        });
      },
    }),
    {
      name: "msafiri-onboarding-v2",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        // returning visitor → re-run the compliance sweep against stored state
        state?.sweep();
      },
    },
  ),
);
