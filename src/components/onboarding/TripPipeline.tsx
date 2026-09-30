"use client";
// ─── Active trip pipeline: navigate → arrive → PIN gate → live trip ─────────
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { Progress } from "@/components/ui/progress";
import { useTripOps } from "@/lib/onboarding/tripStore";
import type { NavIcon, Trip } from "@/lib/onboarding/trips";
import { ksh, NAV_REMAINING_KM } from "@/lib/onboarding/trips";
import { SosButton } from "./SosFlow";
import { toast } from "@/hooks/use-toast";
import {
  ArrowUp, CornerUpLeft, CornerUpRight, RefreshCcw, MapPin, Flag, Navigation, UserCheck, Users,
  Banknote, ShieldCheck, Smartphone, CheckCircle2, XCircle, LifeBuoy, Phone, StickyNote, Timer, Radio,
} from "lucide-react";

const NAV_ICON: Record<NavIcon, typeof ArrowUp> = {
  depart: Navigation,
  straight: ArrowUp,
  left: CornerUpLeft,
  right: CornerUpRight,
  roundabout: RefreshCcw,
  arrive: Flag,
};

const CANCEL_REASONS = ["Passenger no-show", "Wrong pickup point", "Vehicle issue", "Passenger asked to cancel", "Other"];

function RideBadge({ type }: { type: Trip["rideType"] }) {
  return type === "hailed" ? (
    <span className="inline-flex items-center rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[11px] font-semibold text-sky-700">Hailed · stage share</span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-semibold text-purple-700">Chartered · full cab</span>
  );
}

/** Turn-by-turn card used for both legs */
function NavCard({ trip, leg }: { trip: Trip; leg: "to_pickup" | "to_dropoff" }) {
  const advanceNav = useTripOps((s) => s.advanceNav);
  const skipNav = useTripOps((s) => s.skipNav);
  const step = trip.nav[Math.min(trip.navIdx, trip.nav.length - 1)];
  const Icon = NAV_ICON[step.icon];
  const remainingSteps = trip.nav.length - trip.navIdx;
  const remainingKm = NAV_REMAINING_KM(trip.nav, trip.navIdx);
  const etaMin = Math.max(1, Math.round(remainingSteps * 1.1));
  const done = leg === "to_pickup" ? trip.status === "arrived" : trip.atDropoff;

  if (done) return null;

  return (
    <Card className="border-slate-300 bg-slate-900 text-white border-0" data-testid="nav-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
          <Navigation className="h-3.5 w-3.5 text-emerald-400" />
          {leg === "to_pickup" ? `Navigating to pickup · ${trip.pickupPoint}` : `Navigating to drop-off · ${trip.dropoffPoint}`}
          <span className="ml-auto flex items-center gap-1"><Timer className="h-3 w-3" /> ~{etaMin} min</span>
        </div>
        <div className="mt-3 flex items-start gap-3">
          <div className="h-12 w-12 shrink-0 rounded-xl bg-emerald-600 flex items-center justify-center">
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold leading-snug" data-testid="nav-step">{step.text}</p>
            {step.km > 0 && <p className="text-xs text-slate-400 mt-0.5">{step.km} km · then continue</p>}
          </div>
        </div>
        <Progress value={(trip.navIdx / Math.max(1, trip.nav.length - 1)) * 100} className="mt-3 h-1.5 bg-slate-700" />
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>Turn {Math.min(trip.navIdx + 1, trip.nav.length)} of {trip.nav.length} · {remainingKm} km left</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-[11px] text-slate-300 hover:text-white hover:bg-slate-800" onClick={() => advanceNav(trip.id)}>
              Next turn
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px] border-slate-600 bg-transparent text-slate-300 hover:text-white hover:bg-slate-800" onClick={() => skipNav(trip.id)}>
              {leg === "to_pickup" ? "Skip to arrival" : "Skip to drop-off"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TripPipeline({ trip }: { trip: Trip }) {
  const submitPickupPin = useTripOps((s) => s.submitPickupPin);
  const releasePin = useTripOps((s) => s.releasePin);
  const completeTrip = useTripOps((s) => s.completeTrip);
  const cancelTrip = useTripOps((s) => s.cancelTrip);
  const [pin, setPin] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState(CANCEL_REASONS[0]);

  // simulated driving: auto-advance the turn-by-turn every ~6.5s
  useEffect(() => {
    if (trip.status !== "accepted" && trip.status !== "in_progress") return;
    if (trip.status === "in_progress" && trip.atDropoff) return;
    const iv = setInterval(() => useTripOps.getState().advanceNav(trip.id), 6500);
    return () => clearInterval(iv);
  }, [trip.status, trip.atDropoff, trip.id]);

  const onSubmitPin = () => {
    const res = submitPickupPin(trip.id, pin);
    if (res === "ok") {
      toast({ title: "PIN verified — trip started", description: "Live GPS tracking is shared with the safety team. Drive safely!" });
      setPin("");
    } else if (res === "wrong") {
      toast({ title: "Wrong PIN", description: `${2 - trip.pinAttempts} attempt(s) left before this booking locks.`, variant: "destructive" });
      setPin("");
    } else if (res === "locked") {
      toast({ title: "Booking locked", description: "3 wrong entries — contact support to release.", variant: "destructive" });
    }
  };

  const pinHolder = trip.passengers.find((p) => p.kind === "pin_holder");

  return (
    <div className="space-y-3">
      {/* status ribbon */}
      <Card className={`border-0 text-white ${trip.status === "in_progress" ? "bg-gradient-to-r from-emerald-700 to-emerald-600" : "bg-gradient-to-r from-slate-800 to-slate-700"}`}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <RideBadge type={trip.rideType} />
            <span className="text-[11px] text-white/70 font-mono">{trip.payment.ref}</span>
            {trip.status === "in_progress" && (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold" data-testid="live-gps">
                <Radio className="h-3 w-3 animate-pulse text-emerald-300" /> LIVE · GPS shared with safety team
              </span>
            )}
            {trip.status === "accepted" && <span className="ml-auto text-[11px] text-white/80">On the way to pickup</span>}
            {trip.status === "arrived" && <span className="ml-auto text-[11px] text-white/80">Waiting at pickup</span>}
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-emerald-300" />
            {trip.pickupPoint} <span className="text-white/50">→</span> {trip.dropoffPoint}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/75">
            <span>{trip.distanceKm} km · ~{trip.durationMin} min</span>
            <span className="inline-flex items-center gap-1"><Banknote className="h-3 w-3" /> You earn <b className="text-white">{ksh(trip.net)}</b> <span className="text-white/50">{trip.rideType === "hailed" && trip.bookingFee > 0 ? `(seat fare ${ksh(trip.fare - trip.bookingFee)} − 12% · booking fee ${ksh(trip.bookingFee)} deducted)` : `(fare ${ksh(trip.fare)} − 12%)`}</span></span>
            {trip.status === "in_progress" && trip.payment.status === "paid" && (
              <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Fare settled via M-Pesa — no cash handling</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* leg 1: to pickup */}
      {trip.status === "accepted" && <NavCard trip={trip} leg="to_pickup" />}

      {/* arrived — the PIN gate */}
      {trip.status === "arrived" && (
        <Card className="border-emerald-200 bg-white" data-testid="pin-gate">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-600" /> Arrived — verify the passenger before boarding
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Ask {pinHolder?.name ?? "the passenger"} for the 4-digit pickup PIN from their M-Pesa receipt. Like Bolt&apos;s pickup
              code, this guarantees nobody boards with your cab by mistake — and blocks impostor pickups at busy stages.
            </p>

            {trip.pinLocked ? (
              <div className="mt-4 text-center" data-testid="pin-locked">
                <XCircle className="h-10 w-10 text-red-500 mx-auto" />
                <p className="font-semibold text-slate-900 mt-2 text-sm">Booking locked</p>
                <p className="text-xs text-slate-500 mt-1">3 wrong PIN entries. The attempt is audited and the booking is frozen for passenger safety.</p>
                <Button variant="outline" className="mt-3" onClick={() => { releasePin(trip.id); setPin(""); toast({ title: "Booking released", description: "Support verified the passenger — you can enter the PIN again." }); }}>
                  <LifeBuoy className="h-4 w-4 mr-2" /> Contact support &amp; release
                </Button>
              </div>
            ) : (
              <>
                <div className="mt-4 flex justify-center">
                  <InputOTP maxLength={4} value={pin} onChange={setPin} data-testid="pin-input">
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSeparator />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700" onClick={onSubmitPin} disabled={pin.length !== 4} data-testid="pin-submit">
                  <ShieldCheck className="h-4 w-4 mr-2" /> Verify PIN &amp; start trip
                </Button>
                {trip.pinAttempts > 0 && (
                  <p className="text-[11px] text-red-500 text-center mt-2">{trip.pinAttempts} wrong attempt(s) — {3 - trip.pinAttempts} left</p>
                )}
                <p className="text-[11px] text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
                  <Smartphone className="h-3 w-3" /> PIN was sent to the passenger&apos;s phone with the M-Pesa receipt.
                </p>
              </>
            )}

            {/* manifest preview while waiting */}
            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5"><Users className="h-3 w-3" /> Passenger manifest</p>
              <ul className="mt-1.5 space-y-1">
                {trip.passengers.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-xs text-slate-700">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-slate-400">seat {p.seat}</span>
                    {p.kind === "pin_holder" && <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-1.5">pays · holds PIN</span>}
                    <Phone className="ml-auto h-3 w-3 text-slate-300" />
                    <span className="font-mono text-[10px] text-slate-400">{p.phone}</span>
                  </li>
                ))}
              </ul>
              {trip.note && <p className="mt-2 text-[11px] text-slate-500 flex items-center gap-1"><StickyNote className="h-3 w-3" /> {trip.note}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* leg 2: in trip */}
      {trip.status === "in_progress" && (
        <>
          <NavCard trip={trip} leg="to_dropoff" />
          {trip.atDropoff && (
            <Card className="border-emerald-300 bg-emerald-50" data-testid="at-dropoff">
              <CardContent className="p-4 text-center">
                <Flag className="h-8 w-8 text-emerald-600 mx-auto" />
                <p className="font-semibold text-slate-900 mt-2">You have arrived at {trip.dropoffPoint}</p>
                <p className="text-xs text-slate-500 mt-1">Drop the passengers, end the trip — earnings credit instantly from the M-Pesa wallet.</p>
                <Button className="mt-3 bg-emerald-600 hover:bg-emerald-700" onClick={() => { completeTrip(trip.id); toast({ title: "Trip complete", description: `${ksh(trip.net)} credited to your wallet (net of ${trip.rideType === "hailed" && trip.bookingFee > 0 ? "booking fee & " : ""}12% commission).` }); }} data-testid="complete-trip">
                  Complete trip — {ksh(trip.net)} to wallet
                </Button>
              </CardContent>
            </Card>
          )}
          {/* aboard manifest — who is in the car right now */}
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                <Users className="h-3 w-3" /> Aboard — PIN verified at {trip.pinVerifiedAt ? new Date(trip.pinVerifiedAt).toLocaleTimeString("en-KE") : "—"}
              </p>
              <ul className="mt-2 space-y-1.5">
                {trip.passengers.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-xs text-slate-700">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="font-medium">{p.name}</span>
                    <span className="text-slate-400">seat {p.seat} · {p.pickupPoint.replace(" Stage", "")}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      {/* controls: SOS + cancel */}
      <div className="flex items-center justify-between gap-2">
        <SosButton tripId={trip.id} />
        <Button variant="ghost" size="sm" className="text-[11px] text-slate-400 hover:text-red-600" onClick={() => setCancelOpen(true)} data-testid="cancel-open">
          Cancel trip
        </Button>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel this trip?</DialogTitle>
            <DialogDescription>Cancellations are audited. The passenger&apos;s PIN is voided and a refund is triggered.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {CANCEL_REASONS.map((r) => (
              <label key={r} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${reason === r ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}>
                <input type="radio" name="cancel-reason" checked={reason === r} onChange={() => setReason(r)} className="accent-emerald-600" />
                {r}
              </label>
            ))}
            <Button
              className="w-full bg-red-600 hover:bg-red-700"
              data-testid="cancel-confirm"
              onClick={() => {
                cancelTrip(trip.id, reason);
                setCancelOpen(false);
                toast({ title: "Trip cancelled", description: `Reason: ${reason}. The passenger has been notified.` });
              }}
            >
              Cancel trip — {reason}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
