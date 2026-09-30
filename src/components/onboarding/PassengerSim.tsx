"use client";
// ─── Passenger webapp simulator ─────────────────────────────────────────────
// Stand-in for the passenger PWA: books a hailed or chartered trip, pays with
// the M-Pesa STK push, and receives the receipt + 4-digit pickup PIN by SMS.
// Everything booked here flows into the driver's request feed automatically.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTripOps } from "@/lib/onboarding/tripStore";
import { useOnboarding } from "@/lib/onboarding/store";
import { PASSENGER_POOL } from "@/lib/onboarding/registry";
import { BOOKING_FEE_PER_SEAT, ksh, quoteTrip, roadKm, STAGES, type RideType } from "@/lib/onboarding/trips";
import { fmtTime } from "./shared";
import { toast } from "@/hooks/use-toast";
import {
  Smartphone, MessageSquare, Users, CarFront, Banknote, Loader2, CheckCircle2, ChevronDown, ChevronUp, Send,
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  payment_pending: "Awaiting M-Pesa payment",
  new: "Paid — waiting for a checked-in driver",
  accepted: "Driver on the way",
  arrived: "Driver at pickup — share your PIN",
  in_progress: "Trip live — GPS tracking on",
  completed: "Completed",
  cancelled: "Cancelled — refund in progress",
};

export default function PassengerSim({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const bookFromPassenger = useTripOps((s) => s.bookFromPassenger);
  const confirmMpesa = useTripOps((s) => s.confirmMpesa);
  const trips = useTripOps((s) => s.trips);
  const smsLog = useTripOps((s) => s.smsLog);
  const drivers = useOnboarding((s) => s.drivers);

  // booking form state
  const [rideType, setRideType] = useState<RideType>("hailed");
  const [who, setWho] = useState(PASSENGER_POOL[0].name);
  const [pickup, setPickup] = useState("Likoni Ferry Stage");
  const [dropoff, setDropoff] = useState("Diani Beach Stage");
  const [seats, setSeats] = useState("1");
  const [note, setNote] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);

  const km = roadKm(pickup, dropoff);
  const quote = quoteTrip(rideType, km, rideType === "hailed" ? Number(seats) : 1);
  const phone = PASSENGER_POOL.find((p) => p.name === who)?.phone ?? "+254700000000";
  const pendingTrip = trips.find((t) => t.id === pendingId);

  const driverName = (id?: string) => drivers.find((d) => d.id === id)?.profile.fullName ?? "Any checked-in cab";

  const book = () => {
    if (pickup === dropoff) {
      toast({ title: "Pick a different drop-off", variant: "destructive" });
      return;
    }
    const id = bookFromPassenger({
      rideType,
      name: who,
      phone,
      pickup,
      dropoff,
      seats: Number(seats),
      note: note.trim() || undefined,
    });
    setPendingId(id);
    setPushing(true);
    setNote("");
    setTimeout(() => setPushing(false), 1400); // STK push reaches the phone
  };

  const confirm = () => {
    if (!pendingId) return;
    confirmMpesa(pendingId);
    toast({ title: "Payment confirmed", description: "M-Pesa receipt + pickup PIN sent to the passenger. The trip is now in the driver feed." });
  };

  const openBookings = trips.filter((t) => ["payment_pending", "new", "accepted", "arrived", "in_progress"].includes(t.status));

  return (
    <Card className="border-dashed border-slate-300 bg-white">
      <CardContent className="p-4">
        <button className="w-full flex items-center gap-2 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <Smartphone className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-800">Passenger webapp <span className="font-normal text-slate-400">— simulation</span></span>
          <span className="ml-auto text-[11px] text-slate-400">{open ? "Hide" : "Book a trip as a passenger"}</span>
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>

        {open && (
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
            {/* ── booking form ── */}
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">1 · Book &amp; pay</p>

              <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Ride type">
                {(["hailed", "chartered"] as const).map((rt) => (
                  <button
                    key={rt}
                    onClick={() => setRideType(rt)}
                    data-testid={`ride-${rt}`}
                    className={`rounded-xl border p-3 text-left transition-colors ${rideType === rt ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    {rt === "hailed" ? <Users className="h-4 w-4 text-sky-600" /> : <CarFront className="h-4 w-4 text-purple-600" />}
                    <p className="text-xs font-semibold text-slate-800 mt-1">{rt === "hailed" ? "Hailed" : "Chartered"}</p>
                    <p className="text-[10px] text-slate-400">{rt === "hailed" ? "Shared stage cab, per seat" : "Whole vehicle to yourself"}</p>
                  </button>
                ))}
              </div>

              <div className="mt-3 space-y-2.5">
                <div>
                  <Label className="text-[11px] text-slate-500">Passenger</Label>
                  <Select value={who} onValueChange={setWho}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PASSENGER_POOL.map((p) => (
                        <SelectItem key={p.name} value={p.name} className="text-xs">{p.name} · {p.phone}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px] text-slate-500">Pickup stage</Label>
                    <Select value={pickup} onValueChange={setPickup}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STAGES.map((s) => <SelectItem key={s.name} value={s.name} className="text-xs">{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-500">Drop-off stage</Label>
                    <Select value={dropoff} onValueChange={setDropoff}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STAGES.map((s) => <SelectItem key={s.name} value={s.name} className="text-xs">{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {rideType === "hailed" && (
                  <div>
                    <Label className="text-[11px] text-slate-500">Seats needed</Label>
                    <Select value={seats} onValueChange={setSeats}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["1", "2", "3"].map((n) => <SelectItem key={n} value={n} className="text-xs">{n} seat{n !== "1" ? "s" : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-[10px] text-amber-600">A KSh {BOOKING_FEE_PER_SEAT} booking fee applies per seat booked.</p>
                  </div>
                )}
                {rideType === "chartered" && (
                  <div>
                    <Label className="text-[11px] text-slate-500">Note to driver (optional)</Label>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Airport run, 2 suitcases" className="h-16 text-xs" />
                  </div>
                )}
              </div>

              <div className="mt-3 rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-[11px] text-slate-600">
                <div className="flex justify-between"><span>{km} km · ~{Math.max(8, Math.round((km / 28) * 60))} min</span><span className="font-semibold">{ksh(quote.fare)} total</span></div>
                {rideType === "hailed" && (
                  <>
                    <div className="flex justify-between text-slate-400 mt-0.5"><span>Seat fare ({seats} × {ksh(quote.seatFare)})</span><span>{ksh(quote.fareRevenue)}</span></div>
                    <div className="flex justify-between text-slate-400 mt-0.5"><span>Booking fee ({seats} × KSh {BOOKING_FEE_PER_SEAT})</span><span>{ksh(quote.bookingFee)}</span></div>
                  </>
                )}
                <div className="flex justify-between text-slate-400 mt-0.5"><span>Driver receives (net of {rideType === "hailed" ? "booking fee & " : ""}12%)</span><span>{ksh(quote.net)}</span></div>
              </div>

              {pendingTrip && pendingTrip.payment.status === "pending" ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3" data-testid="stk-push">
                  <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                    {pushing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />}
                    M-Pesa STK push sent to {phone}
                  </p>
                  <p className="text-[11px] text-amber-700 mt-1">Booking {pendingTrip.pickupPoint} → {pendingTrip.dropoffPoint}. Enter your M-Pesa PIN on the passenger phone to pay {ksh(pendingTrip.fare)}.</p>
                  <Button size="sm" className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700" onClick={confirm} disabled={pushing} data-testid="confirm-mpesa">
                    {pushing ? "Waiting for M-Pesa PIN…" : "Enter M-Pesa PIN & pay"}
                  </Button>
                </div>
              ) : (
                <Button className="mt-3 w-full bg-slate-900 hover:bg-slate-800" onClick={book} data-testid="book-trip">
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Book trip
                </Button>
              )}
            </div>

            {/* ── passenger phone ── */}
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">2 · Passenger&apos;s phone — SMS &amp; PIN</p>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1" data-testid="sms-log">
                {smsLog.length === 0 && (
                  <p className="text-xs text-slate-400">No messages yet. Book a trip and pay — the M-Pesa receipt and pickup PIN will arrive here.</p>
                )}
                {smsLog.slice(0, 10).map((m) => (
                  <div key={m.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold text-slate-400 flex items-center gap-1"><MessageSquare className="h-3 w-3" /> SMS · {m.phone} · {fmtTime(m.at)}</p>
                    <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-700">{m.text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Open bookings</p>
                <div className="mt-1.5 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {openBookings.length === 0 && <p className="text-xs text-slate-400">None — all trips completed.</p>}
                  {openBookings.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-2.5 py-1.5">
                      <CheckCircle2 className={`h-3 w-3 shrink-0 ${t.status === "payment_pending" ? "text-amber-400" : "text-emerald-500"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-slate-700 truncate">{t.pickupPoint.replace(" Stage", "")} → {t.dropoffPoint.replace(" Stage", "")}</p>
                        <p className="text-[10px] text-slate-400 truncate">{STATUS_LABEL[t.status]} · {driverName(t.driverId)}</p>
                      </div>
                      {t.status === "in_progress" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-label="live" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
