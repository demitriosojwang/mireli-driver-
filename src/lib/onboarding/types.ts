// ─── Msafiri Driver Onboarding — Core Types ─────────────────────────────────
// 7-Point KYD Gate • Automated verification • Lifecycle & renewal • Boarding PIN

export type Role = "driver" | "admin";

/** Full onboarding lifecycle state machine */
export type DriverStatus =
  | "draft" // application started, not submitted
  | "submitted" // submitted — auto-verification queued / running / needs driver action
  | "verifying" // automated checks in progress
  | "action_required" // some docs failed — driver must re-upload
  | "flagged" // auto-check inconclusive — admin manual review
  | "verified" // 7-Point KYD Gate passed
  | "induction" // verified — completing induction modules
  | "contract" // induction done — signing the platform agreement
  | "active" // fully onboarded, may take trips
  | "suspended" // auto: a required document expired
  | "rejected" // fatal finding, application closed
  | "deactivated"; // offboarded

export type DocKind =
  | "id"
  | "dl"
  | "psv_badge"
  | "good_conduct"
  | "insurance"
  | "inspection"
  | "ownership";

export type DocStatus =
  | "missing" // not uploaded yet
  | "uploaded" // uploaded — awaiting automated check
  | "verifying" // check in flight
  | "verified" // API check passed
  | "flagged" // inconclusive — needs human review
  | "failed" // API check definitively failed
  | "expired"; // was verified, validity lapsed (auto-suspension source)

export type OwnerType = "owner" | "hired";

/** One simulated call to a government / insurer registry */
export interface ApiCallLog {
  id: string;
  docKind: DocKind;
  api: string;
  endpoint: string;
  method: "POST" | "GET";
  requestId: string;
  httpStatus: number;
  latencyMs: number;
  at: string; // ISO
  summary: string;
  checks: { label: string; pass: boolean; detail: string }[];
  outcome: "verified" | "failed" | "flagged";
}

export interface DriverDocument {
  kind: DocKind;
  status: DocStatus;
  docNumber?: string;
  issuedAt?: string; // ISO date
  expiresAt?: string | null; // null → permanent
  meta?: Record<string, string>; // kind-specific fields
  attachmentName?: string;
  checkedAt?: string;
  failureReason?: string;
  flagReason?: string;
  adminNote?: string;
  reuploadCount?: number;
}

export interface DriverProfile {
  fullName: string;
  phone: string;
  email?: string;
  idNumber?: string;
  baseStage?: string; // home stage, e.g. "Likoni Ferry"
}

export interface VehicleInfo {
  plate: string;
  model: string;
  seats: number;
  ownerType: OwnerType;
  ownerName?: string; // legal owner when hired
}

export interface InductionRecord {
  modulesDone: number[]; // indices of passed modules
  completedAt?: string;
}

export interface DriverRecord {
  id: string;
  profile: DriverProfile;
  vehicle?: VehicleInfo;
  status: DriverStatus;
  documents: DriverDocument[]; // always 7 entries
  apiLogs: ApiCallLog[];
  flagReasons: string[];
  rejectionReason?: string;
  suspensionReason?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  verifiedAt?: string;
  activatedAt?: string;
  suspendedAt?: string;
  induction?: InductionRecord;
  contract?: { signedName?: string; signedAt?: string };
}

export interface NotificationItem {
  id: string;
  driverId?: string; // undefined → admin feed
  channel: "app" | "sms";
  title: string;
  body: string;
  at: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  actorRole: Role | "system";
  action: string;
  entity: string;
  detail?: string;
  at: string;
}

export interface BoardingSession {
  id: string;
  driverId: string;
  passengerName: string;
  stage: string;
  seats: number;
  pin: string;
  attempts: number;
  state: "awaiting_pin" | "boarding_ok" | "failed";
  createdAt: string;
  verifiedAt?: string;
}

export interface Session {
  role: Role;
  identifier: string;
  name: string;
  driverId?: string; // driver sessions only
  at: string;
}
