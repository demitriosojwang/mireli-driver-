"use client";
// ─── SOS — discreet hold-to-trigger emergency alert ─────────────────────────
// Bolt-parity rule: safety features only work while the driver is checked in.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useTripOps } from "@/lib/onboarding/tripStore";
import { toast } from "@/hooks/use-toast";
import { Siren, ShieldAlert, CheckCircle2, Loader2, Lock, PhoneCall } from "lucide-react";

export function SosButton({ tripId, label = "SOS" }: { tripId?: string; label?: string }) {
  const shiftOnline = useTripOps((s) => s.shiftOnline);
  const triggerSos = useTripOps((s) => s.triggerSos);
  const [open, setOpen] = useState(false);

  const onClick = () => {
    if (!shiftOnline) {
      toast({
        title: "SOS unavailable offline",
        description: "Safety features only work while you are checked in — go online first.",
        variant: "destructive",
      });
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button
        onClick={onClick}
        aria-label="Emergency SOS"
        data-testid="sos-open"
        className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 active:scale-95"
      >
        <Siren className="h-3.5 w-3.5" /> {label}
      </button>

      <SosDialog key={open ? "open" : "closed"} open={open} onOpenChange={setOpen} tripId={tripId} />
    </>
  );
}

export function SosDialog({ open, onOpenChange, tripId }: { open: boolean; onOpenChange: (o: boolean) => void; tripId?: string }) {
  const shiftOnline = useTripOps((s) => s.shiftOnline);
  const triggerSos = useTripOps((s) => s.triggerSos);
  // the alert relevant to this dialog: newest matching alert
  const active = useTripOps((s) => {
    const pool = tripId ? s.sos.filter((a) => a.tripId === tripId) : s.sos;
    return pool[0];
  });
  const [hold, setHold] = useState(0);
  const [fired, setFired] = useState(false);
  const raf = useRef<number | null>(null);

  // local state starts fresh on every mount (SosDialog is re-keyed when opened)

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const startHold = () => {
    const t0 = performance.now();
    const tick = () => {
      const p = Math.min(100, ((performance.now() - t0) / 1400) * 100);
      setHold(p);
      if (p < 100) raf.current = requestAnimationFrame(tick);
      else {
        const id = triggerSos(tripId);
        setFired(true);
        if (!id) toast({ title: "Could not alert", description: "You must be checked in to use SOS.", variant: "destructive" });
      }
    };
    raf.current = requestAnimationFrame(tick);
  };
  const stopHold = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (!fired) setHold(0);
  };

  const live = fired ? active : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {!fired ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <ShieldAlert className="h-5 w-5" /> Emergency SOS
              </DialogTitle>
              <DialogDescription>
                Alerts the Msafiri safety team with your live GPS location{tripId ? ", your trip route and your passenger manifest" : ""}. Use only in a real emergency.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 text-center">
              <button
                onMouseDown={startHold}
                onMouseUp={stopHold}
                onMouseLeave={stopHold}
                onTouchStart={startHold}
                onTouchEnd={stopHold}
                disabled={!shiftOnline}
                data-testid="sos-hold"
                className="mx-auto flex h-28 w-28 select-none flex-col items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform active:scale-95 disabled:opacity-40"
              >
                <Siren className="h-8 w-8" />
                <span className="mt-1 text-sm font-bold">HOLD 2s</span>
              </button>
              <Progress value={hold} className="mx-auto mt-4 h-2 w-48" />
              <p className="mt-2 text-xs text-slate-500">
                {shiftOnline ? "Press and hold — avoids accidental triggers" : "You are checked out — SOS is offline"}
              </p>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <Siren className="h-5 w-5" /> Safety team alerted
              </DialogTitle>
              <DialogDescription>Stay calm — keep doors locked and stay on the live GPS channel.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-1" data-testid="sos-status">
              <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3">
                <PhoneCall className="h-4 w-4 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Alert sent to safety dispatch</p>
                  <p className="text-xs text-red-700 mt-0.5">
                    {live ? `${live.location} · ${new Date(live.at).toLocaleTimeString("en-KE")}` : "Sending…"}
                  </p>
                </div>
              </div>
              {live?.status === "sent" && (
                <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                  <p className="text-sm text-amber-800">Contacting safety team… keep this app open.</p>
                </div>
              )}
              {live?.status === "ack" && (
                <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3" data-testid="sos-ack">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Agent acknowledged — help dispatched</p>
                    <p className="text-xs text-emerald-700 mt-0.5">{live.ackBy} is tracking your live GPS · {live.ackAt ? new Date(live.ackAt).toLocaleTimeString("en-KE") : ""}</p>
                  </div>
                </div>
              )}
              {live?.status === "resolved" && (
                <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Alert closed by {live.resolvedBy}</p>
                    <p className="text-xs text-emerald-700 mt-0.5">{live.note || "All clear."}</p>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-slate-400">Your location, plate, trip route and passenger manifest were shared with the safety team.</p>
              <Button className="w-full bg-slate-800 hover:bg-slate-900" onClick={() => onOpenChange(false)}>
                Keep app in background
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Small offline/locked notice used in locked states */
export function SosOfflineNote() {
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
      <Lock className="h-3 w-3" /> SOS is offline — it turns on automatically when you check in.
    </p>
  );
}
