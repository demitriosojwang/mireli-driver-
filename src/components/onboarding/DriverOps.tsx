"use client";
// ─── Drive tab — the driver's trip operations home ──────────────────────────
// Checked-in shift (Bolt model) → request feed → pipeline → earnings.
// Requests are bookings created & paid in the passenger webapp.
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useOnboarding } from "@/lib/onboarding/store";
import { useTripOps } from "@/lib/onboarding/tripStore";
import { BOOKING_FEE_PER_SEAT, COMMISSION_PCT, ksh, type Trip } from "@/lib/onboarding/trips";
import TripPipeline from "./TripPipeline";
import PassengerSim from "./PassengerSim";
import { toast } from "@/hooks/use-toast";
import {
  Banknote, CarFront, MapPin, Navigation, Radio, ShieldCheck, ShieldOff, Smartphone, Users, Wallet, Lock, Route,
} from "lucide-react";

function RideBadge({ type }: { type: Trip["rideType"] }) {
  return type === "hailed" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[11px] font-semibold text-sky-700"><Users className="h-3 w-3" /> Hailed · stage share</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-semibold text-purple-700"><CarFront className="h-3 w-3" /> Chartered · full cab</span>
  );
}

function RequestCard({ trip }: { trip: Trip }) {
  const acceptTrip = useTripOps((s) => s.acceptTrip);
  const holder = trip.passengers.find((p) => p.kind === "pin_holder");
  return (
    <Card className="border-slate-200 bg-white" data-testid="request-card">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <RideBadge type={trip.rideType} />
          <span className="text-[11px] text-slate-400">{trip.createdAt ? new Date(trip.createdAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
          <span className="ml-auto text-right">
            <span className="block text-[10px] uppercase tracking-wide text-slate-400">You earn</span>
            <span className="block text-base font-bold text-emerald-700 leading-none" data-testid="earn-amount">{ksh(trip.net)}</span>
          </span>
        </div>

        <div className="mt-3 flex items-start gap-2">
          <Navigation className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 leading-snug">{trip.pickupPoint}</p>
            <p className="text-sm text-slate-500 leading-snug">→ {trip.dropoffPoint}</p>
          </div>
          <span className="ml-auto text-[11px] text-slate-400 whitespace-nowrap">{trip.distanceKm} km · ~{trip.durationMin} min</span>
        </div>

        {/* manifest */}
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1">
            <Users className="h-3 w-3" /> Passenger manifest — {trip.passengers.length} aboard
          </p>
          <ul className="mt-1 space-y-0.5">
            {trip.passengers.map((p) => (
              <li key={p.id} className="flex items-center gap-1.5 text-xs text-slate-700">
                <span className="font-medium">{p.name}</span>
                <span className="text-slate-400">· seat {p.seat}</span>
                {p.kind === "pin_holder" && <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-1.5">holds pickup PIN</span>}
              </li>
            ))}
          </ul>
          {trip.note && <p className="mt-1.5 text-[11px] text-slate-500">Note: {trip.note}</p>}
        </div>

        {/* payout breakdown — rule #1: the KSh 50/seat hailed booking fee never reaches the driver */}
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-[11px]" data-testid="payout-breakdown">
          {trip.rideType === "hailed" ? (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">Seat fare ({trip.passengers.length} × {ksh(Math.round((trip.fare - trip.bookingFee) / Math.max(1, trip.passengers.length)))})</span>
                <span className="text-slate-700">{ksh(trip.fare - trip.bookingFee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Booking fee ({trip.passengers.length} × KSh {BOOKING_FEE_PER_SEAT} — Msafiri)</span>
                <span className="text-slate-700">−{ksh(trip.bookingFee)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between">
              <span className="text-slate-500">Charter fare (whole cab)</span>
              <span className="text-slate-700">{ksh(trip.fare)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">Msafiri commission ({COMMISSION_PCT}%)</span>
            <span className="text-slate-700">−{ksh(trip.commission)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold">
            <span className="text-slate-600">Your payout</span>
            <span className="text-emerald-700" data-testid="payout-net">{ksh(trip.net)}</span>
          </div>
          {trip.rideType === "hailed" && (
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
              The KSh {BOOKING_FEE_PER_SEAT}/seat booking fee is charged on the passenger&apos;s fare and deducted before your payout — it goes to Msafiri, not your earnings.
            </p>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>Passenger pays {ksh(trip.fare)} · settled via M-Pesa</span>
          <Banknote className="h-3.5 w-3.5" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { acceptTrip(trip.id); toast({ title: "Trip accepted", description: `Navigate to ${trip.pickupPoint} — the PIN gate opens when you arrive.` }); }} data-testid="accept-trip">
            Accept
          </Button>
          <Button variant="outline" onClick={() => toast({ title: "Request declined", description: "The booking returns to the stage feed." })}>
            Decline
          </Button>
        </div>
        {holder && <p className="mt-2 text-[10px] text-slate-400 flex items-center gap-1"><Smartphone className="h-3 w-3" /> Pickup PIN was texted to {holder.name} with their M-Pesa receipt — collect it on arrival.</p>}
      </CardContent>
    </Card>
  );
}

export default function DriverOps() {
  const session = useOnboarding((s) => s.session);
  const driver = useOnboarding((s) => s.drivers.find((d) => d.id === s.session?.driverId));
  const shiftOnline = useTripOps((s) => s.shiftOnline);
  const onlineSince = useTripOps((s) => s.onlineSince);
  const trips = useTripOps((s) => s.trips);
  const goOnline = useTripOps((s) => s.goOnline);
  const goOffline = useTripOps((s) => s.goOffline);

  if (!driver || !session) return null;

  // ── KYD gate: trips only for fully onboarded drivers ──
  if (driver.status !== "active") {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-5 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
            <Lock className="h-5 w-5 text-slate-400" />
          </div>
          <h3 className="mt-3 font-semibold text-slate-900">Drive is locked by the KYD Gate</h3>
          <p className="text-sm text-slate-500 mt-1">
            Trip requests, navigation and SOS unlock only when all 7 documents are valid and your account is active.
          </p>
        </CardContent>
      </Card>
    );
  }

  const myActive = trips.find((t) => t.driverId === driver.id && ["accepted", "arrived", "in_progress"].includes(t.status));
  const feed = trips.filter((t) => t.status === "new" && !t.driverId);
  const completed = trips
    .filter((t) => t.driverId === driver.id && t.status === "completed")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const todayKey = new Date().toDateString();
  const todays = completed.filter((t) => t.completedAt && new Date(t.completedAt).toDateString() === todayKey);
  const todayNet = todays.reduce((s, t) => s + t.net, 0);
  const walletNet = completed.reduce((s, t) => s + t.net, 0);

  const toggleShift = (on: boolean) => {
    if (on) {
      goOnline();
      toast({ title: "Checked in", description: "GPS sharing is on — stage requests will appear here as passengers pay." });
    } else {
      const res = goOffline();
      if (!res.ok) {
        toast({ title: "Cannot check out", description: res.reason, variant: "destructive" });
      } else {
        toast({ title: "Checked out", description: "You are hidden from passengers — GPS and SOS are off." });
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* ── shift / checked-in card ── */}
      <Card className={`border-0 text-white ${shiftOnline ? "bg-gradient-to-br from-emerald-700 to-emerald-600" : "bg-gradient-to-br from-slate-800 to-slate-700"}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold flex items-center gap-2" data-testid="shift-state">
                {shiftOnline ? <><Radio className="h-4 w-4 text-emerald-300 animate-pulse" /> Checked in — receiving requests</> : <>Checked out</>}
              </p>
              <p className="text-[11px] text-white/70 mt-0.5">
                {shiftOnline
                  ? `Since ${onlineSince ? new Date(onlineSince).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }) : "—"} · stage ${driver.profile.baseStage ?? "Likoni Ferry Stage"}`
                  : "Go online to receive passenger bookings, share live GPS and keep SOS armed."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/70 hidden sm:inline">{shiftOnline ? "On" : "Off"}</span>
              <Switch checked={shiftOnline} onCheckedChange={toggleShift} aria-label="Check in / out" data-testid="shift-toggle" />
            </div>
          </div>
          {/* safety telemetry — Bolt-parity: tied to being in-app */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
            <div className={`rounded-lg px-2 py-1.5 ${shiftOnline ? "bg-white/10" : "bg-white/5"}`}>
              <p className="flex items-center gap-1 font-semibold"><Navigation className="h-3 w-3" /> Live GPS</p>
              <p className={shiftOnline ? "text-emerald-300" : "text-white/40"}>{shiftOnline ? "Sharing with safety team" : "Off"}</p>
            </div>
            <div className={`rounded-lg px-2 py-1.5 ${shiftOnline ? "bg-white/10" : "bg-white/5"}`}>
              <p className="flex items-center gap-1 font-semibold"><ShieldCheck className="h-3 w-3" /> SOS</p>
              <p className={shiftOnline ? "text-emerald-300" : "text-white/40"}>{shiftOnline ? "Armed" : "Offline"}</p>
            </div>
            <div className={`rounded-lg px-2 py-1.5 ${shiftOnline ? "bg-white/10" : "bg-white/5"}`}>
              <p className="flex items-center gap-1 font-semibold"><MapPin className="h-3 w-3" /> Visibility</p>
              <p className={shiftOnline ? "text-emerald-300" : "text-white/40"}>{shiftOnline ? "Visible at stages" : "Hidden"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── active trip pipeline ── */}
      {myActive ? (
        <TripPipeline trip={myActive} />
      ) : shiftOnline ? (
        feed.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 flex items-center gap-2" data-testid="feed-label">
              <Route className="h-3.5 w-3.5 text-emerald-600" /> Trip requests from the passenger app ({feed.length})
            </p>
            {feed.map((t) => <RequestCard key={t.id} trip={t} />)}
          </div>
        ) : (
          <Card className="border-dashed border-slate-300">
            <CardContent className="p-6 text-center">
              <Smartphone className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-700 mt-2">No requests yet</p>
              <p className="text-xs text-slate-400 mt-1">Requests appear here the moment a passenger pays with M-Pesa. Book one from the passenger webapp below to see the flow.</p>
            </CardContent>
          </Card>
        )
      ) : (
        <Card className="border-dashed border-slate-300 bg-slate-50/60">
          <CardContent className="p-6 text-center">
            <ShieldOff className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-sm font-medium text-slate-700 mt-2">You are checked out</p>
            <p className="text-xs text-slate-400 mt-1">Trip requests, GPS tracking and the SOS button only work while you are checked in — the same rule Bolt runs in Kenya.</p>
          </CardContent>
        </Card>
      )}

      {/* ── earnings ── */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900">Earnings</h3>
            <span className="ml-auto text-[11px] text-slate-400">Net of booking fees &amp; {COMMISSION_PCT}% commission</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
              <p className="text-[10px] uppercase tracking-wide text-emerald-600">Today</p>
              <p className="text-xl font-bold text-emerald-700" data-testid="earnings-today">{ksh(todayNet)}</p>
              <p className="text-[10px] text-emerald-600/70">{todays.length} trip{todays.length === 1 ? "" : "s"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Wallet (all time)</p>
              <p className="text-xl font-bold text-slate-800">{ksh(walletNet)}</p>
              <p className="text-[10px] text-slate-400">{completed.length} trip{completed.length === 1 ? "" : "s"} · paid out Mondays</p>
            </div>
          </div>
          {completed.length > 0 && (
            <div className="mt-3 space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {completed.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 truncate">{t.pickupPoint.replace(" Stage", "")} → {t.dropoffPoint.replace(" Stage", "")}</p>
                    <p className="text-[10px] text-slate-400">
                      {t.completedAt ? new Date(t.completedAt).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""} · {t.passengers.length} pax · <span className="font-mono">{t.payment.ref}</span>
                    </p>
                  </div>
                  <RideBadge type={t.rideType} />
                  <span className="text-xs font-bold text-emerald-700 whitespace-nowrap">+{ksh(t.net)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── passenger webapp simulator ── */}
      <div data-testid="passenger-sim">
        <PassengerSim />
      </div>
    </div>
  );
}
