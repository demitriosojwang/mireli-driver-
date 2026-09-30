// ─── The 7-Point KYD Document Registry ──────────────────────────────────────
// Source: Msafiri legal compliance table (Kenya PSV regulations)
import type { DocKind } from "./types";

export interface DocumentRequirement {
  kind: DocKind;
  order: number;
  name: string;
  short: string;
  authority: string;
  validity: string;
  purpose: string;
  scope: "driver" | "vehicle";
  api: { name: string; endpoint: string };
}

export const DOCUMENT_REGISTRY: DocumentRequirement[] = [
  {
    kind: "id",
    order: 1,
    name: "National ID or Valid Passport",
    short: "ID / Passport",
    authority: "Ministry of Interior / Immigration",
    validity: "Permanent",
    purpose: "Legal identity and citizenship verification",
    scope: "driver",
    api: { name: "eCitizen IPRS", endpoint: "iprs.ecitizen.go.ke/api/v1/identity/verify" },
  },
  {
    kind: "dl",
    order: 2,
    name: "Kenyan Driving Licence (DL)",
    short: "Driving Licence",
    authority: "NTSA (TIMS / eCitizen)",
    validity: "1 or 3 years",
    purpose: "Class B / C / E with PSV endorsement",
    scope: "driver",
    api: { name: "NTSA TIMS", endpoint: "tims.ntsa.go.ke/api/v1/licence/verify" },
  },
  {
    kind: "psv_badge",
    order: 3,
    name: "NTSA PSV Driver Badge / Licence",
    short: "PSV Badge",
    authority: "NTSA",
    validity: "Annual (1 year)",
    purpose: "Statutory authorisation to carry paying passengers",
    scope: "driver",
    api: { name: "NTSA PSV Registry", endpoint: "ntsa.go.ke/api/v1/psv/badge/verify" },
  },
  {
    kind: "good_conduct",
    order: 4,
    name: "Certificate of Good Conduct",
    short: "Good Conduct",
    authority: "Directorate of Criminal Investigations (DCI)",
    validity: "12 months",
    purpose: "Criminal record check — no assault, theft or violent crime",
    scope: "driver",
    api: { name: "DCI Clearance Portal", endpoint: "dci.go.ke/api/v1/clearance/verify" },
  },
  {
    kind: "insurance",
    order: 5,
    name: "Commercial PSV Comprehensive Insurance",
    short: "PSV Insurance",
    authority: "Registered Kenyan Underwriter",
    validity: "12 months",
    purpose: "Third-party property damage + passenger bodily injury / death cover",
    scope: "vehicle",
    api: { name: "IRA Policy Register", endpoint: "ira.go.ke/api/v1/policy/verify" },
  },
  {
    kind: "inspection",
    order: 6,
    name: "NTSA Motor Vehicle Inspection Sticker",
    short: "Inspection Sticker",
    authority: "NTSA Motor Vehicle Inspection Unit",
    validity: "Annual (1 year)",
    purpose: "Roadworthiness — brakes, tyres, speed governor, seatbelts",
    scope: "vehicle",
    api: { name: "NTSA MVIU", endpoint: "ntsa.go.ke/api/v1/inspection/verify" },
  },
  {
    kind: "ownership",
    order: 7,
    name: "Logbook or Certified Owner Lease Agreement",
    short: "Logbook / Lease",
    authority: "NTSA (TIMS) / Commissioner for Oaths",
    validity: "Permanent / contract duration",
    purpose: "Legal custody and authorisation to operate the vehicle",
    scope: "vehicle",
    api: { name: "NTSA TIMS Ownership", endpoint: "tims.ntsa.go.ke/api/v1/ownership/verify" },
  },
];

export const DOC_BY_KIND: Record<DocKind, DocumentRequirement> = Object.fromEntries(
  DOCUMENT_REGISTRY.map((d) => [d.kind, d]),
) as Record<DocKind, DocumentRequirement>;

/** Licence classes accepted for Msafiri feeder cabs */
export const ALLOWED_DL_CLASSES = ["B", "C", "E"] as const;
export const DL_CLASSES: { value: string; label: string }[] = [
  { value: "B", label: "Class B — saloon / estate cars" },
  { value: "C", label: "Class C — light commercial (pickup, van)" },
  { value: "E", label: "Class E — heavy commercial / PSV" },
  { value: "A", label: "Class A — motorcycle (boda) — not accepted for cabs" },
];

/** IRA-registered underwriters accepted in the demo */
export const IRA_UNDERWRITERS = [
  "Jubilee Allianz Insurance",
  "CIC Insurance Group",
  "Britam General Insurance",
  "APA Insurance",
  "UAP Old Mutual",
  "Madison Insurance",
  "First Assurance",
  "Geminia Insurance",
];
/** A deliberately unregistered seller used to demo the failure path */
export const UNREGISTERED_UNDERWRITER = "Rapid Cover Agencies (kiosk)";

export const INDUCTION_MODULES = [
  {
    title: "Module 1 — Platform & Stage Rules",
    body: "How stage-based allocation works, the 70% fill threshold, queue fairness at Likoni Ferry and Diani, and how auto-assign picks the next cab.",
    quiz: {
      q: "A stage shows 2 waiting passengers and your 4-seater is empty. What must you do?",
      options: [
        "Drive straight to the stage and load",
        "Wait for the platform auto-assign request before boarding",
        "Shout for passengers at the stage",
      ],
      answer: 1,
    },
  },
  {
    title: "Module 2 — Passenger Safety & Care",
    body: "Seatbelt enforcement, child passenger rules, speed-governor compliance, night-trip protocol and the SOS button.",
    quiz: {
      q: "Passengers must board only after:",
      options: [
        "The boarding PIN is verified in the app",
        "They wave at you",
        "You recognise them",
      ],
      answer: 0,
    },
  },
  {
    title: "Module 3 — Boarding PIN Protocol",
    body: "Every passenger receives a unique 4-digit PIN. The trip cannot start until you enter it. PINs change per booking, blocking impostor pickups at busy stages.",
    quiz: {
      q: "The passenger's 4-digit PIN is used to:",
      options: [
        "Unlock a discount",
        "Confirm you picked up the correct passenger",
        "Rate the trip",
      ],
      answer: 1,
    },
  },
  {
    title: "Module 4 — Document Compliance Duties",
    body: "All 7 KYD documents must stay valid. Upload renewals before expiry; the platform auto-suspends drivers the day any document lapses.",
    quiz: {
      q: "Your PSV badge expires in 10 days. You should:",
      options: [
        "Keep driving until it expires",
        "Upload the renewed badge before expiry day",
        "Book a holiday",
      ],
      answer: 1,
    },
  },
];

export const CONTRACT_CLAUSES = [
  "You will maintain all seven (7) KYD documents in valid status at all times and upload renewals before expiry.",
  "You will only board passengers whose 4-digit boarding PIN you have verified in the Msafiri driver app.",
  "Fare is collected via M-Pesa to the platform wallet; payouts are made weekly every Monday to your registered number.",
  "The platform commission is 12% of fare. Repeat safety violations attract up to 100% commission surcharge.",
  "Msafiri may suspend your account immediately and automatically when any compliance document expires.",
  "Either party may terminate this agreement with 14 days written notice through the platform.",
];

export const PASSENGER_POOL = [
  { name: "Amina Hassan", stage: "Likoni Ferry Stage", phone: "+254733776201" },
  { name: "Brian Ochieng", stage: "Shelly Beach Stage", phone: "+254712884431" },
  { name: "Cynthia Mwikali", stage: "Diani Beach Stage", phone: "+254720447119" },
  { name: "David Kitonga", stage: "Ukunda Stage", phone: "+254719330825" },
  { name: "Esther Njeri", stage: "Msambweni Stage", phone: "+254729664308" },
  { name: "Felix Ndlovu", stage: "Pemba Pier Stage", phone: "+254714958142" },
];

export const ADMIN_EMAILS = ["demitri@msafiri.co.ke", "admin@msafiri.co.ke"];
export const ADMIN_2FA_CODE = "msafiri2026";
