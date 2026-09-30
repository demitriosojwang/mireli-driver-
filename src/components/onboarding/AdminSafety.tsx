"use client";
// ─── Admin — Safety & live operations ───────────────────────────────────────
// SOS alert queue (dispatch ack/resolve) + live trip monitor.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useOnboarding } from "@/lib/onboarding/store";
import { useTripOps } from "@/lib/onboarding/tripStore";
import { fmtTime } from "./shared";
import { toast } from "@/hooks/use-toast";
import {
  Siren, CheckCheck, CheckCircle2, Radio, MapPin, Users, CarFront, ShieldCheck,
} from "lucide-react";

const SOS_STATUS: Record<string, { label: string; cls: string }> = {
  sent: { label: "ALERT — needs dispatch", cls: "bg-red-100 text-red-800 border-red-300 animate-pulse" },
  ack: { label: "Agent dispatched", cls: "bg-amber-50 text-amber-800 border-amber-300" },
  resolved: { label: "Closed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const TRIP_STATUS: Record<string, { label: string; cls: string }> = {
  payment_pending: { label: "Awaiting payment", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  new: { label: "In driver feed", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  accepted: { label: "Driver en route", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  arrived: { label: "At pickup — PIN gate", cls: "bg-purple-50 text-purple-800 border-purple-200" },
  in_progress: { label: "Trip live · GPS on", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export default function AdminSafety() {
  const drivers = useOnboarding((s) => s.drivers);
  const sos = useTripOps((s) => s.sos);
  const trips = useTripOps((s) => s.trips);
  const ackSos = useTripOps((s) => s.ackSos);
  const resolveSos = useTripOps((s) => s.resolveSos);
  const [resolving, setResolving] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const driverName = (id: string) => drivers.find((d) => d.id === id)?.profile.fullName ?? id;
  const liveTrips = trips.filter((t) => ["new", "accepted", "arrived", "in_progress"].includes(t.status));
  const openAlerts = sos.filter((a) => a.status !== "resolved");

  return (
    <div className="space-y-4">
      {/* live ops strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <Radio className="h-4 w-4" />, label: "Live trips", value: trips.filter((t) => t.status === "in_progress").length, cls: "text-emerald-700 bg-emerald-50 border-emerald-100" },
          { icon: <CarFront className="h-4 w-4" />, label: "In pipeline", value: liveTrips.length, cls: "text-sky-700 bg-sky-50 border-sky-100" },
          { icon: <Siren className="h-4 w-4" />, label: "Open SOS alerts", value: openAlerts.length, cls: openAlerts.length > 0 ? "text-red-700 bg-red-50 border-red-200" : "text-slate-600 bg-slate-50 border-slate-100" },
          { icon: <ShieldCheck className="h-4 w-4" />, label: "PIN-gated boardings today", value: trips.filter((t) => t.pinVerifiedAt && new Date(t.pinVerifiedAt).toDateString() === new Date().toDateString()).length, cls: "text-purple-700 bg-purple-50 border-purple-100" },
        ].map((s) => (
          <Card key={s.label} className={`border ${s.cls}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 opacity-80">{s.icon}<span className="text-[11px] font-medium">{s.label}</span></div>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SOS queue */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Siren className="h-4 w-4 text-red-600" /> SOS dispatch queue
        </h3>
        {sos.length === 0 && (
          <Card><CardContent className="p-6 text-center text-sm text-slate-400">No SOS alerts. Drivers can only trigger SOS while checked in — alerts arrive here with live GPS, plate and manifest.</CardContent></Card>
        )}
        {sos.map((a) => {
          const meta = SOS_STATUS[a.status];
          return (
            <Card key={a.id} className={a.status === "sent" ? "border-red-300 bg-red-50/50" : "border-slate-200"} data-testid={`sos-${a.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${meta.cls}`}>
                    <Siren className="h-3 w-3" /> {meta.label}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{a.driverName}</span>
                  <span className="text-[11px] font-mono text-slate-400">{a.plate}</span>
                  <span className="ml-auto text-[11px] text-slate-400">{fmtTime(a.at)}{a.tripId ? " · during trip" : ""}</span>
                </div>
                <div className="mt-2 grid gap-1.5 text-xs text-slate-600 sm:grid-cols-2">
                  <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {a.location} <span className="font-mono text-[10px] text-slate-400">({a.lat.toFixed(3)}, {a.lng.toFixed(3)})</span></p>
                  <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-slate-400" /> Aboard: {a.aboard}</p>
                </div>
                {a.status === "ack" && a.ackBy && <p className="mt-2 text-[11px] text-amber-700">Acknowledged by {a.ackBy} at {a.ackAt ? fmtTime(a.ackAt) : "—"}</p>}
                {a.status === "resolved" && <p className="mt-2 text-[11px] text-emerald-700">Closed by {a.resolvedBy}{a.note ? ` — ${a.note}` : ""}</p>}

                {a.status !== "resolved" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {a.status === "sent" && (
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { ackSos(a.id); toast({ title: "Alert acknowledged", description: "Agent dispatched — driver notified in-app." }); }}>
                        Acknowledge &amp; dispatch
                      </Button>
                    )}
                    {resolving === a.id ? (
                      <div className="flex w-full gap-2">
                        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Closure note (e.g. false alarm, driver safe)" className="h-8 text-xs" data-testid="sos-note" />
                        <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => { resolveSos(a.id, note); setResolving(null); setNote(""); toast({ title: "SOS closed", description: "The driver has been notified." }); }} data-testid="sos-resolve-confirm">
                          <CheckCheck className="h-3.5 w-3.5" /> Close
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setResolving(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setResolving(a.id)} data-testid="sos-resolve-open">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Close alert
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* live trips monitor */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Radio className="h-4 w-4 text-emerald-600" /> Live trips monitor
        </h3>
        {liveTrips.length === 0 && (
          <Card><CardContent className="p-6 text-center text-sm text-slate-400">No trips in flight. Paid bookings from the passenger app appear here until completion.</CardContent></Card>
        )}
        {liveTrips.map((t) => {
          const meta = TRIP_STATUS[t.status];
          return (
            <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>{meta.label}</span>
              <p className="text-xs font-medium text-slate-800">{t.driverId ? driverName(t.driverId) : "Awaiting driver"}</p>
              <p className="text-xs text-slate-500 truncate">{t.pickupPoint} → {t.dropoffPoint}</p>
              <span className="ml-auto text-[11px] text-slate-400">{t.passengers.length} pax · {t.fare.toLocaleString("en-KE")} KSh · <span className="font-mono">{t.payment.ref ?? "unpaid"}</span></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
