// ─── Msafiri Trip Operations — Domain Model ─────────────────────────────────
// Passenger webapp → driver app data flow: hailed & chartered bookings,
// passenger manifest, corridor fares (12% platform commission + KSh 50/seat
// hailed booking fee), turn-by-turn navigation, and the M-Pesa pickup PIN
// (Bolt-style pickup code, proven in KE).

export type RideType = "hailed" | "chartered";

export type TripStatus =
  | "payment_pending" // created in passenger webapp, M-Pesa STK push out
  | "new" // paid — waiting in the driver request feed
  | "accepted" // driver checked in & accepted — navigating to pickup
  | "arrived" // at pickup point — awaiting the passenger's 4-digit PIN
  | "in_progress" // PIN verified — trip running, GPS live
  | "completed"
  | "cancelled";

export type NavIcon = "depart" | "straight" | "left" | "right" | "roundabout" | "arrive";

/** One row of the passenger manifest the driver must honour for this trip */
export interface ManifestEntry {
  id: string;
  name: string;
  phone: string;
  seat: number;
  kind: "pin_holder" | "co_rider"; // PIN holder paid & holds the pickup code
  pickupPoint: string;
}

export interface NavStep {
  icon: NavIcon;
  text: string;
  km: number;
}

export interface TripPayment {
  method: "mpesa";
  status: "pending" | "paid";
  ref?: string; // e.g. QGH7K2M9PZ
  paidAt?: string;
  amount?: number;
  pin?: string; // 4-digit pickup PIN — generated once, on payment confirmation
  pinSentTo?: string; // passenger phone that received PIN + receipt
}

export interface Trip {
  id: string;
  rideType: RideType;
  status: TripStatus;
  passengers: ManifestEntry[]; // the manifest
  pickupPoint: string;
  dropoffPoint: string;
  note?: string;
  distanceKm: number; // road km pickup→dropoff
  durationMin: number;
  fare: number; // passenger paid via M-Pesa (fare revenue + booking fee)
  bookingFee: number; // KSh 50 × seats (hailed only) — platform revenue, deducted BEFORE the driver payout
  commission: number; // platform 12% of the fare revenue (never on the booking fee)
  net: number; // what the driver makes = fare − bookingFee − commission
  payment: TripPayment;
  nav: NavStep[]; // active leg turn-by-turn (to pickup, then to dropoff)
  navIdx: number; // current step index into nav
  pinAttempts: number;
  pinLocked: boolean;
  pinVerifiedAt?: string;
  atDropoff: boolean; // in_progress leg finished → ready to complete
  driverId?: string; // assigned on accept
  sosId?: string; // open alert on this trip
  createdAt: string;
  acceptedAt?: string;
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface SosAlert {
  id: string;
  tripId?: string;
  driverId: string;
  driverName: string;
  plate: string;
  at: string;
  location: string;
  lat: number;
  lng: number;
  aboard: string; // manifest names travelling at trigger time
  status: "sent" | "ack" | "resolved";
  ackAt?: string;
  ackBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  note?: string;
}

// ── Corridor geography (Likoni Ferry ⇄ Diani, South Coast) ─────────────────

export interface StagePoint {
  name: string;
  km: number; // chainage from Likoni Ferry along the corridor
  lat: number;
  lng: number;
}

export const STAGES: StagePoint[] = [
  { name: "Likoni Ferry Stage", km: 0, lat: -4.0598, lng: 39.669 },
  { name: "Shelly Beach Stage", km: 6, lat: -4.0754, lng: 39.6712 },
  { name: "Tiwi Beach Stage", km: 15, lat: -4.103, lng: 39.6852 },
  { name: "Ukunda Stage", km: 33, lat: -4.283, lng: 39.563 },
  { name: "Diani Beach Stage", km: 36, lat: -4.282, lng: 39.592 },
  { name: "Pemba Pier Stage", km: 50, lat: -4.3515, lng: 39.5598 },
  { name: "Galu Kinondo Stage", km: 44, lat: -4.328, lng: 39.585 },
  { name: "Msambweni Stage", km: 58, lat: -4.474, lng: 39.479 },
];

export function stageByName(name: string): StagePoint {
  return STAGES.find((s) => s.name === name) ?? STAGES[0];
}

/** Road distance between two stages (corridor factor 1.15 on straight chainage) */
export function roadKm(a: string, b: string): number {
  const d = Math.abs(stageByName(a).km - stageByName(b).km) * 1.15;
  return Math.round(d * 10) / 10;
}

// ── Fare engine (commission 12% — platform agreement clause 4) ──────────────
// Payout rule #1: every seat booked in a HAILED trip carries an extra KSh 50
// booking fee charged on top of the passenger's fares. The fee is deducted
// BEFORE the driver is paid out — it is Msafiri revenue and never enters the
// driver's commission base. Chartered bookings reserve the whole cab, so no
// per-seat fee applies.

export const COMMISSION_PCT = 12;
export const BOOKING_FEE_PER_SEAT = 50;

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** Hailed (stage share) — per-seat price, Kenya corridor realistic */
export function hailedSeatFare(km: number): number {
  return roundTo(100 + km * 3.2, 10);
}

/** Chartered — whole vehicle, min KSh 500 */
export function charteredFare(km: number): number {
  return Math.max(500, roundTo(300 + km * 45, 50));
}

export interface FareQuote {
  fare: number; // passenger pays (seat/charter fare + booking fee)
  fareRevenue: number; // driver-earning portion (booking fee excluded)
  seatFare: number; // per-seat price (hailed) · whole-cab fare (chartered)
  bookingFee: number; // platform revenue — deducted before the driver payout
  commission: number; // 12% of fareRevenue
  net: number; // driver payout = fare − bookingFee − commission
}

export function quoteTrip(rideType: RideType, km: number, seats: number): FareQuote {
  if (rideType === "hailed") {
    const seatFare = hailedSeatFare(km);
    const fareRevenue = seatFare * seats;
    const bookingFee = BOOKING_FEE_PER_SEAT * seats; // rule #1: extra 50 per booked seat
    const fare = fareRevenue + bookingFee;
    const commission = Math.round((fareRevenue * COMMISSION_PCT) / 100);
    return { fare, fareRevenue, seatFare, bookingFee, commission, net: fareRevenue - commission };
  }
  const seatFare = charteredFare(km);
  const bookingFee = 0; // whole-cab booking — no per-seat fee
  const commission = Math.round((seatFare * COMMISSION_PCT) / 100);
  return { fare: seatFare, fareRevenue: seatFare, seatFare, bookingFee, commission, net: seatFare - commission };
}

export function tripDurationMin(km: number): number {
  return Math.max(8, Math.round((km / 28) * 60)); // 28 km/h urban corridor average
}

export const ksh = (n: number) => `KSh ${n.toLocaleString("en-KE")}`;

// ── Turn-by-turn navigation generator (deterministic per trip) ──────────────

const INTERIOR: { icon: NavIcon; text: string }[] = [
  { icon: "straight", text: "Continue onto Lunga Lunga Road (A14) past the fuel station" },
  { icon: "right", text: "Turn right at Kona Musa onto Shelly Beach Road" },
  { icon: "straight", text: "Stay on the coast highway past Mwakirunge junction" },
  { icon: "left", text: "Turn left past Tiwi junction toward the beach hotels" },
  { icon: "roundabout", text: "At the roundabout take the 2nd exit onto Ukunda–Airstrip Road" },
  { icon: "right", text: "Turn right onto Diani Beach Road at the shopping centre" },
  { icon: "straight", text: "Go straight past the bank junction and the market gates" },
  { icon: "left", text: "Slight left onto the beach strip road" },
  { icon: "right", text: "Turn right after the airstrip fence" },
  { icon: "straight", text: "Follow the cab lane past the stage marshals' shade" },
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Build a stable turn-by-turn plan between two corridor stages */
export function genNav(from: string, to: string, tripId: string): NavStep[] {
  const a = stageByName(from);
  const b = stageByName(to);
  const km = roadKm(from, to);
  const dir = b.km >= a.km ? "south-west along the coast" : "north-east toward the Likoni Ferry";
  const nInterior = Math.min(6, Math.max(3, Math.round(km / 8) + 2));
  const off = hashStr(tripId) % INTERIOR.length;
  const interior: NavStep[] = Array.from({ length: nInterior }, (_, i) => {
    const t = INTERIOR[(off + i) % INTERIOR.length];
    const share = i === 0 ? 0.2 : i === nInterior - 1 ? 0.25 : (0.55 / Math.max(1, nInterior - 2));
    return { ...t, km: Math.max(0.4, Math.round(km * share * 10) / 10) };
  });
  return [
    { icon: "depart", text: `Head ${dir} from ${from}`, km: Math.max(0.3, Math.round(km * 0.08 * 10) / 10) },
    ...interior,
    { icon: "arrive", text: `Arrive at ${to}`, km: 0 },
  ];
}

export const NAV_REMAINING_KM = (nav: NavStep[], idx: number) =>
  Math.round(nav.slice(idx).reduce((s, x) => s + x.km, 0) * 10) / 10;

// ── M-Pesa helpers ──────────────────────────────────────────────────────────

export function genPin(): string {
  return String(1000 + Math.floor(Math.random() * 9000));
}

export function genMpesaRef(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let r = "Q";
  for (let i = 0; i < 9; i++) r += abc[Math.floor(Math.random() * abc.length)];
  return r;
}

/** The exact M-Pesa confirmation SMS the passenger receives — PIN + receipt in one message */
export function mpesaSms(t: Trip): string {
  const dt = new Date(t.payment.paidAt ?? t.createdAt);
  const date = dt.toLocaleDateString("en-KE", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const time = dt.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: true });
  const seats = t.rideType === "hailed" ? t.passengers.length : 0;
  const feeLine =
    t.rideType === "hailed" && t.bookingFee > 0
      ? `\nIncludes booking fee KSh ${t.bookingFee.toLocaleString("en-KE")}.00 (KSh ${BOOKING_FEE_PER_SEAT} × ${seats} seat${seats === 1 ? "" : "s"}).`
      : "";
  return (
    `${t.payment.ref} Confirmed. KSh ${t.fare.toLocaleString("en-KE")}.00 paid to MSAFIRI CAB LIKONI` +
    ` on ${date} at ${time}.${feeLine}` +
    `\nPickup PIN: ${t.payment.pin} — show it to your driver before boarding.` +
    `\nTrip: ${t.pickupPoint} → ${t.dropoffPoint} (${t.rideType === "hailed" ? `hailed stage cab, ${seats} seat${seats === 1 ? "" : "s"}` : "chartered cab"}).` +
    ` e-receipt: msafiri.co.ke/r/${t.payment.ref}`
  );
}

// ── Seed world (Kevin active; 2 paid requests waiting + 2 completed trips) ──

const iso = (minAgo: number) => new Date(Date.now() - minAgo * 60000).toISOString();

function seedTrip(
  id: string,
  rideType: RideType,
  pickup: string,
  dropoff: string,
  status: TripStatus,
  createdAtMinAgo: number,
  extra: Partial<Trip>,
): Trip {
  const km = roadKm(pickup, dropoff);
  const seats = extra.passengers?.length ?? 1;
  const q = quoteTrip(rideType, km, rideType === "hailed" ? seats : 1);
  const base: Trip = {
    id,
    rideType,
    status,
    passengers: [],
    pickupPoint: pickup,
    dropoffPoint: dropoff,
    distanceKm: km,
    durationMin: tripDurationMin(km),
    fare: q.fare,
    bookingFee: q.bookingFee,
    commission: q.commission,
    net: q.net,
    payment: { method: "mpesa", status: status === "payment_pending" ? "pending" : "paid", amount: status === "payment_pending" ? undefined : q.fare },
    nav: [],
    navIdx: 0,
    pinAttempts: 0,
    pinLocked: false,
    atDropoff: false,
    createdAt: iso(createdAtMinAgo),
  };
  // merge (not replace) any seeded payment so amount always matches the fare engine
  const { payment: extraPayment, ...rest } = extra;
  return { ...base, ...rest, payment: { ...base.payment, ...(extraPayment ?? {}) } };
}

const ent = (i: string, name: string, phone: string, seat: number, kind: ManifestEntry["kind"], pickup: string): ManifestEntry => ({
  id: i,
  name,
  phone,
  seat,
  kind,
  pickupPoint: pickup,
});

export function buildSeedTrips(): { trips: Trip[]; sos: SosAlert[] } {
  const trips: Trip[] = [
    // ── paid & waiting in the feed ──
    seedTrip("trp_seed_h1", "hailed", "Shelly Beach Stage", "Diani Beach Stage", "new", 4, {
      passengers: [
        ent("m1", "Brian Ochieng", "+254712884431", 1, "pin_holder", "Shelly Beach Stage"),
        ent("m2", "Nadia Awuor", "+254734002918", 2, "co_rider", "Shelly Beach Stage"),
      ],
      payment: { method: "mpesa", status: "paid", ref: "QG8R4TK21M", paidAt: iso(3), pin: "6184", pinSentTo: "+254712884431" },
      note: "Two surfboards in the boot",
    }),
    seedTrip("trp_seed_c1", "chartered", "Diani Beach Stage", "Likoni Ferry Stage", "new", 11, {
      passengers: [ent("m3", "Cynthia Mwikali", "+254720447119", 1, "pin_holder", "Diani Beach Stage")],
      payment: { method: "mpesa", status: "paid", ref: "QJ2N7WZ90X", paidAt: iso(10), pin: "3471", pinSentTo: "+254720447119" },
      note: "Airport ferry run — 2 suitcases, keep boot clear",
    }),
    // ── completed history ──
    seedTrip("trp_seed_h0", "hailed", "Likoni Ferry Stage", "Diani Beach Stage", "completed", 60 * 26, {
      passengers: [ent("m4", "Amina Hassan", "+254733776201", 1, "pin_holder", "Likoni Ferry Stage")],
      driverId: "drv_kevin",
      payment: { method: "mpesa", status: "paid", ref: "QF1H8DAP6K", paidAt: iso(60 * 25.7), pin: "9052", pinSentTo: "+254733776201" },
      pinVerifiedAt: iso(60 * 25.5),
      startedAt: iso(60 * 25.5),
      completedAt: iso(60 * 24.6),
    }),
    seedTrip("trp_seed_c0", "chartered", "Ukunda Stage", "Msambweni Stage", "completed", 60 * 6, {
      passengers: [ent("m5", "David Kitonga", "+254719330825", 1, "pin_holder", "Ukunda Stage")],
      driverId: "drv_kevin",
      payment: { method: "mpesa", status: "paid", ref: "QG5M2PXW44", paidAt: iso(60 * 5.9), pin: "7730", pinSentTo: "+254719330825" },
      pinVerifiedAt: iso(60 * 5.8),
      startedAt: iso(60 * 5.8),
      completedAt: iso(60 * 4.7),
    }),
  ];
  return { trips, sos: [] };
}
