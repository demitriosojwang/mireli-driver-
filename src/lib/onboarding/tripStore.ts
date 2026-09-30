"use client";
// ─── Msafiri Trip Operations Store ──────────────────────────────────────────
// Reads bookings created in the passenger webapp, runs the driver pipeline:
// checked-in shift → request feed → accept → navigate → PIN gate → live trip
// (GPS + SOS) → completion & earnings. All safety events are audited.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useOnboarding } from "./store";
import {
  BOOKING_FEE_PER_SEAT,
  COMMISSION_PCT,
  genMpesaRef,
  genNav,
  genPin,
  mpesaSms,
  quoteTrip,
  roadKm,
  tripDurationMin,
  buildSeedTrips,
} from "./trips";
import type { ManifestEntry, RideType, SosAlert, Trip } from "./trips";

const nowIso = () => new Date().toISOString();
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

/** write into the onboarding store's shared feeds (driver SMS log + admin feed + audit) */
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

/** passenger-side SMS log (M-Pesa receipt + PIN, trip updates) */
export interface PassengerSms {
  id: string;
  tripId?: string;
  phone: string;
  text: string;
  at: string;
}

export interface BookingInput {
  rideType: RideType;
  name: string;
  phone: string;
  pickup: string;
  dropoff: string;
  seats: number; // hailed: seats wanted (1-3)
  note?: string;
}

interface TripOpsState {
  shiftOnline: boolean;
  onlineSince: string | null;
  trips: Trip[];
  sos: SosAlert[];
  smsLog: PassengerSms[];
  bookingSeq: number;

  // shift (checked-in) — Bolt model: GPS, requests & SOS only while checked in
  goOnline: () => void;
  goOffline: () => { ok: boolean; reason?: string };

  // passenger webapp side
  bookFromPassenger: (input: BookingInput) => string; // → tripId
  confirmMpesa: (tripId: string) => void; // STK push confirmed

  // driver pipeline
  acceptTrip: (tripId: string) => void;
  declineTrip: (tripId: string) => void;
  arrive: (tripId: string) => void;
  advanceNav: (tripId: string) => void;
  skipNav: (tripId: string) => void;
  submitPickupPin: (tripId: string, pin: string) => "ok" | "wrong" | "locked" | "none";
  releasePin: (tripId: string) => void; // support resets a locked booking
  completeTrip: (tripId: string) => void;
  cancelTrip: (tripId: string, reason: string) => void;

  // safety
  triggerSos: (tripId?: string) => string | null;
  ackSos: (id: string) => void;
  resolveSos: (id: string, note: string) => void;

  resetTrips: () => void;
}

const ACTIVE_STATUSES = ["accepted", "arrived", "in_progress"] as const;

export const useTripOps = create<TripOpsState>()(
  persist(
    (set, get) => ({
      shiftOnline: false,
      onlineSince: null,
      trips: buildSeedTrips().trips,
      sos: [],
      smsLog: [],
      bookingSeq: 0,

      // ── shift ────────────────────────────────────────────────────────────
      goOnline: () => {
        const st = useOnboarding.getState();
        const drv = st.drivers.find((d) => d.id === st.session?.driverId);
        if (!drv || drv.status !== "active") return; // KYD gate
        set({ shiftOnline: true, onlineSince: nowIso() });
        logAudit({ actor: drv.profile.phone, actorRole: "driver", action: "shift.check_in", entity: drv.id, detail: "Driver checked in — GPS sharing on, receiving requests" });
      },

      goOffline: () => {
        const st = useOnboarding.getState();
        const drv = st.drivers.find((d) => d.id === st.session?.driverId);
        if (!drv) return { ok: false, reason: "No driver session" };
        const live = get().trips.find((t) => t.driverId === drv.id && ACTIVE_STATUSES.includes(t.status as (typeof ACTIVE_STATUSES)[number]));
        if (live) {
          return { ok: false, reason: "You are checked in for a live trip. GPS tracking and SOS must stay on until you complete or cancel it." };
        }
        set({ shiftOnline: false, onlineSince: null });
        logAudit({ actor: drv.profile.phone, actorRole: "driver", action: "shift.check_out", entity: drv.id, detail: "Checked out — hidden from passengers, GPS off" });
        return { ok: true };
      },

      // ── passenger webapp ────────────────────────────────────────────────
      bookFromPassenger: (input) => {
        const km = roadKm(input.pickup, input.dropoff);
        const seats = input.rideType === "hailed" ? Math.min(3, Math.max(1, input.seats)) : 1;
        const q = quoteTrip(input.rideType, km, input.rideType === "hailed" ? seats : 1);
        const id = `trp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const manifest: ManifestEntry[] = [
          { id: uid("m"), name: input.name, phone: input.phone, seat: 1, kind: "pin_holder", pickupPoint: input.pickup },
        ];
        if (input.rideType === "hailed" && seats > 1) {
          // co-riders share the hailed stage cab under one paid booking
          for (let i = 1; i < seats; i++) {
            manifest.push({ id: uid("m"), name: `Co-rider (seat ${i + 1})`, phone: "—", seat: i + 1, kind: "co_rider", pickupPoint: input.pickup });
          }
        }
        const trip: Trip = {
          id,
          rideType: input.rideType,
          status: "payment_pending",
          passengers: manifest,
          pickupPoint: input.pickup,
          dropoffPoint: input.dropoff,
          note: input.note,
          distanceKm: km,
          durationMin: tripDurationMin(km),
          fare: q.fare,
          bookingFee: q.bookingFee, // KSh 50 × seats on hailed — deducted before the driver payout
          commission: q.commission,
          net: q.net,
          payment: { method: "mpesa", status: "pending" },
          nav: [],
          navIdx: 0,
          pinAttempts: 0,
          pinLocked: false,
          atDropoff: false,
          createdAt: nowIso(),
        };
        set((s) => ({ trips: [trip, ...s.trips], bookingSeq: s.bookingSeq + 1 }));
        logAudit({ actor: input.phone, actorRole: "system", action: "trip.booked", entity: id, detail: `${input.rideType} · ${input.pickup} → ${input.dropoff} · awaiting M-Pesa` });
        return id;
      },

      confirmMpesa: (tripId) => {
        const t = get().trips.find((x) => x.id === tripId);
        if (!t || t.payment.status === "paid") return;
        const pin = genPin();
        const ref = genMpesaRef();
        const paidAt = nowIso();
        const paid: Trip = {
          ...t,
          status: "new",
          payment: { ...t.payment, status: "paid", ref, paidAt, amount: t.fare, pin, pinSentTo: t.passengers[0]?.phone },
        };
        set((s) => ({ trips: s.trips.map((x) => (x.id === tripId ? paid : x)) }));
        const sms: PassengerSms = { id: uid("sms"), tripId, phone: paid.payment.pinSentTo ?? "—", text: mpesaSms(paid), at: paidAt };
        set((s) => ({ smsLog: [sms, ...s.smsLog] }));
        notify({
          title: "New paid trip request",
          body: `${paid.rideType === "hailed" ? "Hailed" : "Chartered"} · ${paid.pickupPoint} → ${paid.dropoffPoint} · ${paid.passengers.length} passenger(s) · fare ${paid.fare.toLocaleString("en-KE")} KSh — waiting in the driver feed.`,
        });
        logAudit({ actor: "mpesa.daraja", actorRole: "system", action: "trip.paid", entity: tripId, detail: `${ref} · KSh ${paid.fare} · pickup PIN issued to ${paid.payment.pinSentTo}` });
      },

      // ── driver pipeline ─────────────────────────────────────────────────
      acceptTrip: (tripId) => {
        const st = useOnboarding.getState();
        const drv = st.drivers.find((d) => d.id === st.session?.driverId);
        if (!drv || drv.status !== "active") return;
        if (!get().shiftOnline) return; // must be checked in to accept
        const t = get().trips.find((x) => x.id === tripId);
        if (!t || t.status !== "new") return;
        const from = drv.profile.baseStage ?? "Likoni Ferry Stage";
        const nav = genNav(from, t.pickupPoint, `${t.id}:leg1`);
        set((s) => ({
          trips: s.trips.map((x) => (x.id === tripId ? { ...x, status: "accepted", driverId: drv.id, acceptedAt: nowIso(), nav, navIdx: 0 } : x)),
        }));
        logAudit({ actor: drv.profile.phone, actorRole: "driver", action: "trip.accept", entity: tripId, detail: `Navigating from ${from} to ${t.pickupPoint}` });
      },

      declineTrip: (tripId) => {
        const t = get().trips.find((x) => x.id === tripId);
        const st = useOnboarding.getState();
        if (!t || t.status !== "new") return;
        // declined → returns to the open feed for the next checked-in cab
        logAudit({ actor: st.session?.identifier ?? "driver", actorRole: "driver", action: "trip.decline", entity: tripId });
      },

      arrive: (tripId) => {
        const t = get().trips.find((x) => x.id === tripId);
        if (!t || t.status !== "accepted") return;
        set((s) => ({ trips: s.trips.map((x) => (x.id === tripId ? { ...x, status: "arrived", arrivedAt: nowIso() } : x)) }));
        const holder = t.passengers.find((p) => p.kind === "pin_holder");
        notify({
          title: "Driver at pickup point",
          body: `Msafiri: Your driver is waiting at ${t.pickupPoint}. Share the 4-digit pickup PIN from your M-Pesa message with the driver to start the trip.`,
        });
        logAudit({ actor: "system", actorRole: "system", action: "trip.arrived", entity: tripId, detail: `Awaiting PIN from ${holder?.name ?? "passenger"}` });
      },

      advanceNav: (tripId) => {
        const t = get().trips.find((x) => x.id === tripId);
        if (!t) return;
        if (t.status === "accepted") {
          const next = t.navIdx + 1;
          if (next >= t.nav.length) {
            get().arrive(tripId);
            return;
          }
          set((s) => ({ trips: s.trips.map((x) => (x.id === tripId ? { ...x, navIdx: next } : x)) }));
        } else if (t.status === "in_progress") {
          const next = t.navIdx + 1;
          if (next >= t.nav.length) {
            set((s) => ({ trips: s.trips.map((x) => (x.id === tripId ? { ...x, navIdx: next, atDropoff: true } : x)) }));
            return;
          }
          set((s) => ({ trips: s.trips.map((x) => (x.id === tripId ? { ...x, navIdx: next } : x)) }));
        }
      },

      skipNav: (tripId) => {
        const t = get().trips.find((x) => x.id === tripId);
        if (!t) return;
        if (t.status === "accepted") get().arrive(tripId);
        else if (t.status === "in_progress") set((s) => ({ trips: s.trips.map((x) => (x.id === tripId ? { ...x, navIdx: x.nav.length, atDropoff: true } : x)) }));
      },

      submitPickupPin: (tripId, pin) => {
        const t = get().trips.find((x) => x.id === tripId);
        const st = useOnboarding.getState();
        if (!t || t.status !== "arrived" || !t.driverId) return "none";
        if (t.pinLocked) return "locked";
        if (t.payment.pin && pin.trim() === t.payment.pin) {
          const nav = genNav(t.pickupPoint, t.dropoffPoint, `${t.id}:leg2`);
          set((s) => ({
            trips: s.trips.map((x) =>
              x.id === tripId
                ? { ...x, status: "in_progress", pinVerifiedAt: nowIso(), startedAt: nowIso(), nav, navIdx: 0, atDropoff: false }
                : x,
            ),
          }));
          const aboard = t.passengers.map((p) => p.name).join(", ");
          const sms: PassengerSms = {
            id: uid("sms"),
            tripId,
            phone: t.passengers[0]?.phone ?? "—",
            text: `Msafiri: PIN accepted. ${t.passengers.length === 1 ? aboard : `Boarding party (${t.passengers.length})`} verified at ${t.pickupPoint}. Trip to ${t.dropoffPoint} started — live GPS tracking is on and shared with the safety team. Save emergency 0800 722 100.`,
            at: nowIso(),
          };
          set((s) => ({ smsLog: [sms, ...s.smsLog] }));
          logAudit({ actor: st.session?.identifier ?? "driver", actorRole: "driver", action: "trip.pin_ok", entity: tripId, detail: `Boarding verified — trip started with ${aboard}` });
          return "ok";
        }
        const attempts = t.pinAttempts + 1;
        const locked = attempts >= 3;
        set((s) => ({
          trips: s.trips.map((x) => (x.id === tripId ? { ...x, pinAttempts: attempts, pinLocked: locked } : x)),
        }));
        logAudit({
          actor: st.session?.identifier ?? "driver",
          actorRole: "driver",
          action: locked ? "trip.pin_locked" : "trip.pin_wrong",
          entity: tripId,
          detail: `Attempt ${attempts}/3`,
        });
        if (locked) {
          notify({
            driverId: t.driverId,
            title: "Booking locked",
            body: "Msafiri: 3 wrong PIN entries. For passenger safety this booking is locked and the attempt is audited — contact support to release it.",
          });
          notify({
            title: "PIN lockout",
            body: `${t.pickupPoint}: 3 failed pickup PIN attempts. Impostor-pickup safeguard triggered — release from the Safety queue after verification.`,
          });
        }
        return locked ? "locked" : "wrong";
      },

      releasePin: (tripId) => {
        const st = useOnboarding.getState();
        set((s) => ({
          trips: s.trips.map((x) => (x.id === tripId ? { ...x, pinLocked: false, pinAttempts: 0 } : x)),
        }));
        logAudit({ actor: st.session?.identifier ?? "support", actorRole: "admin", action: "trip.pin_release", entity: tripId, detail: "Support released a locked booking after verification" });
      },

      completeTrip: (tripId) => {
        const t = get().trips.find((x) => x.id === tripId);
        if (!t || t.status !== "in_progress" || !t.driverId) return;
        set((s) => ({ trips: s.trips.map((x) => (x.id === tripId ? { ...x, status: "completed", completedAt: nowIso() } : x)) }));
        const wallet = get()
          .trips.filter((x) => x.driverId === t.driverId && x.status === "completed")
          .reduce((sum, x) => sum + x.net, 0);
        // payout explanation — hailed trips show the booking fee deducted before payout
        const payoutLine =
          t.rideType === "hailed" && t.bookingFee > 0
            ? `seat fare ${(t.fare - t.bookingFee).toLocaleString("en-KE")} + booking fee ${t.bookingFee.toLocaleString("en-KE")} (KSh ${BOOKING_FEE_PER_SEAT}/seat to Msafiri) − ${COMMISSION_PCT}% commission`
            : `fare ${t.fare.toLocaleString("en-KE")} − ${COMMISSION_PCT}% commission`;
        notify({
          driverId: t.driverId,
          channel: "sms",
          title: "Trip complete",
          body: `Msafiri: Asante! ${t.passengers[0]?.name ?? "Passenger"} delivered. Net ${t.net.toLocaleString("en-KE")} KSh (${payoutLine}) credited. Wallet: ${wallet.toLocaleString("en-KE")} KSh.`,
        });
        notify({
          title: "Trip completed",
          body: `${t.rideType === "hailed" ? "Hailed" : "Chartered"} trip ${t.pickupPoint} → ${t.dropoffPoint} completed. Driver net ${t.net.toLocaleString("en-KE")} KSh${t.bookingFee > 0 ? ` (booking fee ${t.bookingFee.toLocaleString("en-KE")} KSh retained by Msafiri)` : ""}.`,
        });
        logAudit({ actor: "system", actorRole: "system", action: "trip.completed", entity: tripId, detail: `Driver net ${t.net} KSh · booking fee ${t.bookingFee} KSh · commission ${t.commission} KSh` });
      },

      cancelTrip: (tripId, reason) => {
        const t = get().trips.find((x) => x.id === tripId);
        const st = useOnboarding.getState();
        if (!t) return;
        set((s) => ({
          trips: s.trips.map((x) => (x.id === tripId ? { ...x, status: "cancelled", cancelledAt: nowIso(), cancelReason: reason } : x)),
        }));
        if (t.payment.pin) {
          const sms: PassengerSms = {
            id: uid("sms"),
            tripId,
            phone: t.passengers[0]?.phone ?? "—",
            text: `Msafiri: Trip ${t.pickupPoint} → ${t.dropoffPoint} was cancelled (${reason}). Ref ${t.payment.ref}. Your M-Pesa refund is being processed and the pickup PIN ${t.payment.pin} is now void.`,
            at: nowIso(),
          };
          set((s) => ({ smsLog: [sms, ...s.smsLog] }));
        }
        logAudit({ actor: st.session?.identifier ?? "driver", actorRole: "driver", action: "trip.cancelled", entity: tripId, detail: reason });
      },

      // ── safety ──────────────────────────────────────────────────────────
      triggerSos: (tripId) => {
        const st = useOnboarding.getState();
        const drv = st.drivers.find((d) => d.id === st.session?.driverId);
        if (!drv) return null;
        if (!get().shiftOnline) return null; // Bolt parity: safety features need checked-in status
        const t = tripId ? get().trips.find((x) => x.id === tripId) : undefined;
        const loc = t ? (t.status === "in_progress" ? `En route: ${t.pickupPoint} → ${t.dropoffPoint}` : t.pickupPoint) : drv.profile.baseStage ?? "Likoni Ferry Stage";
        const ref = { lat: -4.1, lng: 39.62 };
        const alert: SosAlert = {
          id: uid("sos"),
          tripId,
          driverId: drv.id,
          driverName: drv.profile.fullName,
          plate: drv.vehicle?.plate ?? "—",
          at: nowIso(),
          location: loc,
          ...ref,
          aboard: t ? t.passengers.map((p) => `${p.name} (seat ${p.seat})`).join(", ") : "No passengers",
          status: "sent",
        };
        set((s) => ({
          sos: [alert, ...s.sos],
          trips: tripId ? s.trips.map((x) => (x.id === tripId ? { ...x, sosId: alert.id } : x)) : s.trips,
        }));
        notify({
          driverId: drv.id,
          title: "SOS alerted",
          body: "Msafiri Safety: Alert received. Keep your doors locked and stay on the live GPS channel. Help is being dispatched — you are not alone.",
        });
        notify({
          title: "SOS — immediate response",
          body: `${drv.profile.fullName} (${drv.vehicle?.plate}) triggered SOS at ${loc}. Aboard: ${alert.aboard}. Live GPS active.`,
        });
        logAudit({ actor: drv.profile.phone, actorRole: "driver", action: "sos.triggered", entity: alert.id, detail: loc });
        // safety team acknowledges within seconds (simulated dispatch)
        setTimeout(() => {
          const cur = get().sos.find((a) => a.id === alert.id);
          if (cur && cur.status === "sent") {
            set((s) => ({ sos: s.sos.map((a) => (a.id === alert.id ? { ...a, status: "ack", ackAt: nowIso(), ackBy: "M. Otieno — Safety Dispatch" } : a)) }));
            notify({
              driverId: drv.id,
              title: "Safety team acknowledged",
              body: "Msafiri Safety: Agent M. Otieno acknowledged and is tracking your live GPS. Stay in the car with doors locked until the agent arrives.",
            });
            logAudit({ actor: "safety.dispatch", actorRole: "system", action: "sos.ack", entity: alert.id, detail: "Agent dispatched to live GPS location" });
          }
        }, 2800);
        return alert.id;
      },

      ackSos: (id) => {
        const st = useOnboarding.getState();
        set((s) => ({ sos: s.sos.map((a) => (a.id === id && a.status === "sent" ? { ...a, status: "ack", ackAt: nowIso(), ackBy: st.session?.name ?? "Compliance" } : a)) }));
        logAudit({ actor: st.session?.identifier ?? "admin", actorRole: "admin", action: "sos.ack", entity: id });
      },

      resolveSos: (id, note) => {
        const st = useOnboarding.getState();
        set((s) => ({
          sos: s.sos.map((a) => (a.id === id && a.status !== "resolved" ? { ...a, status: "resolved", resolvedAt: nowIso(), resolvedBy: st.session?.name ?? "Compliance", note } : a)),
          trips: s.trips.map((t) => (t.sosId === id ? { ...t, sosId: undefined } : t)),
        }));
        const a = get().sos.find((x) => x.id === id);
        if (a?.driverId) {
          notify({
            driverId: a.driverId,
            title: "SOS resolved",
            body: `Msafiri Safety: Your alert has been closed. ${note || "All clear — karibu tena on the road."}`,
          });
        }
        logAudit({ actor: st.session?.identifier ?? "admin", actorRole: "admin", action: "sos.resolved", entity: id, detail: note });
      },

      resetTrips: () => {
        const seed = buildSeedTrips();
        set({ shiftOnline: false, onlineSince: null, trips: seed.trips, sos: seed.sos, smsLog: [], bookingSeq: 0 });
      },
    }),
    {
      name: "msafiri-trips-v2", // v2: trips now carry bookingFee — old persisted state is dropped
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
