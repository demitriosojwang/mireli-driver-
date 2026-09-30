"use client";
// ─── Boarding PIN — Uber-style trip start verification ──────────────────────
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { useOnboarding } from "@/lib/onboarding/store";
import type { DriverRecord } from "@/lib/onboarding/types";
import { toast } from "@/hooks/use-toast";
import {
  Smartphone, ShieldCheck, Lock, RefreshCcw, CheckCircle2, XCircle, MapPin, User, Armchair, Timer, LifeBuoy,
} from "lucide-react";

export default function TripPin({ driver }: { driver: DriverRecord }) {
  const boarding = useOnboarding((s) => s.boarding);
  const requestBoarding = useOnboarding((s) => s.requestBoarding);
  const submitPin = useOnboarding((s) => s.submitPin);
  const clearBoarding = useOnboarding((s) => s.clearBoarding);
  const [pin, setPin] = useState("");

  // ── KYD gate enforcement: non-active drivers can never reach the PIN screen
  if (driver.status !== "active") {
    const missing = driver.documents.filter((d) => !["verified"].includes(d.status));
    return (
      <Card className="border-slate-200">
        <CardContent className="p-5 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
            <Lock className="h-5 w-5 text-slate-400" />
          </div>
          <h3 className="mt-3 font-semibold text-slate-900">Trips locked by the KYD Gate</h3>
          <p className="text-sm text-slate-500 mt-1">
            Boarding opens only after all 7 documents verify. Right now {7 - missing.length}/7 are valid
            {driver.status === "suspended" && driver.suspensionReason ? ` — ${driver.suspensionReason}` : ""}.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {missing.map((d) => (
              <span key={d.kind} className="text-[11px] rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-0.5">
                {d.kind === "id" ? "ID / Passport" : d.kind === "dl" ? "Driving Licence" : d.kind === "psv_badge" ? "PSV Badge" : d.kind === "good_conduct" ? "Good Conduct" : d.kind === "insurance" ? "PSV Insurance" : d.kind === "inspection" ? "Inspection Sticker" : "Logbook / Lease"}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── active driver, no booking yet
  if (!boarding) {
    return (
      <div className="space-y-4">
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="p-5">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> You are verified &amp; trip-ready
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              When a passenger books your cab, they receive a unique 4-digit boarding PIN. You can only start the
              trip after entering it — this guarantees you board the right passenger and blocks impostor pickups
              at busy stages like Likoni Ferry and Diani.
            </p>
            <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setPin(""); requestBoarding(); }}>
              <RefreshCcw className="h-4 w-4 mr-2" /> Simulate passenger booking
            </Button>
          </CardContent>
        </Card>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { icon: <User className="h-4 w-4" />, t: "Correct passenger", d: "PIN proves the person boarding matches the booking." },
            { icon: <MapPin className="h-4 w-4" />, t: "Anti-hijack at stages", d: "Impostors cannot pose as passengers at Likoni or Diani." },
            { icon: <Timer className="h-4 w-4" />, t: "New PIN per trip", d: "Codes never repeat — expired PINs are useless." },
          ].map((x) => (
            <div key={x.t} className="rounded-xl border border-slate-200 bg-white p-3">
              <span className="text-emerald-700">{x.icon}</span>
              <p className="text-sm font-semibold text-slate-800 mt-1.5">{x.t}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{x.d}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── active driver with a live boarding session
  const locked = boarding.state === "failed";
  const done = boarding.state === "boarding_ok";

  const onSubmit = () => {
    const res = submitPin(pin);
    if (res === "wrong") {
      toast({ title: "Wrong PIN", description: `${2 - boarding.attempts} attempt(s) left before this booking locks.` });
      setPin("");
    } else if (res === "locked") {
      toast({ title: "Booking locked", description: "3 wrong entries. Contact support to release." });
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* passenger phone mock */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
            <Smartphone className="h-3.5 w-3.5" /> Passenger&apos;s phone (simulation)
          </p>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">{boarding.passengerName}</p>
              <span className="text-[11px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">e-ticket paid · M-Pesa</span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-slate-500">
              <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {boarding.stage}</p>
              <p className="flex items-center gap-1.5"><Armchair className="h-3 w-3" /> {boarding.seats} seat(s) · Feeder cab</p>
            </div>
            <div className="mt-3 rounded-xl bg-white border border-slate-200 p-3 text-center">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Boarding PIN</p>
              <p className="text-3xl font-bold tracking-[0.35em] text-slate-900 mt-1" data-testid="boarding-pin">{boarding.pin}</p>
              <p className="text-[10px] text-slate-400 mt-1">Show this PIN to the driver when they arrive</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            In production the passenger sees this in their Msafiri app after M-Pesa payment confirms.
          </p>
        </CardContent>
      </Card>

      {/* driver entry */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Your screen — enter passenger PIN</p>

          {done ? (
            <div className="mt-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <p className="font-semibold text-slate-900 mt-2">Boarding verified</p>
              <p className="text-sm text-slate-500 mt-1">
                {boarding.passengerName} boarded at {boarding.stage}. Trip started — drive safely.
              </p>
              <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3 text-left text-xs text-slate-600">
                <p className="font-semibold text-slate-700 mb-1">Trip manifest</p>
                <p>Passenger: {boarding.passengerName} · {boarding.seats} seat(s)</p>
                <p>Stage: {boarding.stage}</p>
                <p>PIN verified at: {boarding.verifiedAt ? new Date(boarding.verifiedAt).toLocaleTimeString("en-KE") : "—"}</p>
              </div>
              <Button className="mt-4 bg-slate-800 hover:bg-slate-900" onClick={() => { clearBoarding(); setPin(""); }}>
                Complete boarding — next booking
              </Button>
            </div>
          ) : locked ? (
            <div className="mt-4 text-center">
              <XCircle className="h-10 w-10 text-red-500 mx-auto" />
              <p className="font-semibold text-slate-900 mt-2">Booking locked</p>
              <p className="text-sm text-slate-500 mt-1">
                3 wrong PIN entries. For passenger safety this booking is frozen and the attempt is audited.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => { clearBoarding(); setPin(""); }}>
                <LifeBuoy className="h-4 w-4 mr-2" /> Contact support &amp; reset
              </Button>
            </div>
          ) : (
            <>
              <div className="mt-4 flex justify-center">
                <InputOTP maxLength={4} value={pin} onChange={setPin} disabled={false}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSeparator />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <p className="text-[11px] text-slate-400 text-center mt-2">
                Ask the passenger for their 4-digit PIN before you start the trip.
              </p>
              <Button className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700" onClick={onSubmit} disabled={pin.length !== 4}>
                Verify &amp; start trip
              </Button>
              {boarding.attempts > 0 && (
                <p className="text-[11px] text-red-500 text-center mt-2">{boarding.attempts} wrong attempt(s) — {3 - boarding.attempts} left</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
