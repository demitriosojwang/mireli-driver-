// ─── Msafiri Driver Onboarding SOP — content module ─────────────────────────
// All narrative text, table data and section structure (English, Profile A).

const T7DOC = [
  ["1", "National ID or Valid Passport", "Ministry of Interior / Immigration", "Permanent", "Legal identity and citizenship verification."],
  ["2", "Kenyan Driving Licence (DL)", "NTSA (TIMS / eCitizen)", "1 or 3 years", "Class B / C / E with PSV endorsement."],
  ["3", "NTSA PSV Driver Badge / Licence", "NTSA", "Annual (1 year)", "Official statutory authorisation to carry paying passengers."],
  ["4", "Certificate of Good Conduct", "Directorate of Criminal Investigations (DCI)", "12 months", "Criminal record check (no history of assault, theft, or violent crime)."],
  ["5", "Commercial PSV Comprehensive Insurance", "Registered Kenyan Underwriter", "12 months", "Covers third-party property damage and passenger bodily injury or death."],
  ["6", "NTSA Motor Vehicle Inspection Sticker", "NTSA Motor Vehicle Inspection Unit", "Annual (1 year)", "Roadworthiness verification (brakes, tyres, speed governor, seatbelts)."],
  ["7", "Logbook or Certified Owner Lease Agreement", "NTSA (TIMS) / Commissioner for Oaths", "Permanent / contract duration", "Proof that the driver has legal custody and authorisation to operate the vehicle."],
];

const T_LIFECYCLE = [
  ["Draft", "Application opened; profile, vehicle and document capture in progress. Nothing is checked yet.", "Driver"],
  ["Submitted", "All seven documents uploaded. The automated verification queue accepts the application.", "Driver action complete"],
  ["Auto-verifying", "Each document is checked against its issuing registry in sequence. Every API call is logged.", "System"],
  ["Action required", "One or more documents failed outright (expired, wrong class, missing cover). Driver must re-upload.", "Driver"],
  ["Flagged", "A check is inconclusive, most commonly a name mismatch between registries. Routed to a compliance officer for manual review.", "Compliance officer"],
  ["Verified", "7-Point KYD Gate passed. Unlocks induction.", "System"],
  ["Induction", "Four short modules with a knowledge check: stage rules, passenger safety, boarding PIN protocol, document duties.", "Driver"],
  ["Contract", "Partner agreement review and electronic signature.", "Driver"],
  ["Active", "Fully onboarded. May receive bookings; every boarding is PIN-verified.", "System"],
  ["Suspended", "A mandatory document expired. Trips blocked automatically until renewals clear re-verification.", "System"],
  ["Rejected / Deactivated", "Fatal finding (for example an adverse criminal record) or offboarding. Appeal path documented.", "Compliance officer"],
];

const T_APIS = [
  ["National ID / Passport", "eCitizen IPRS - identity/verify", "Number format; holder name versus application; citizenship status; scan legibility"],
  ["Driving Licence", "NTSA TIMS - licence/verify", "Licence number in TIMS; class B, C or E; PSV endorsement active; validity window"],
  ["PSV Driver Badge", "NTSA PSV Registry - badge/verify", "Badge number in registry; annual validity; holder name match"],
  ["Good Conduct", "DCI Clearance Portal - clearance/verify", "Reference recognised; adverse record search; certificate within 12 months"],
  ["PSV Insurance", "IRA Policy Register - policy/verify", "Underwriter on IRA register; comprehensive cover including passenger liability; insured plate match; validity"],
  ["Inspection Sticker", "NTSA MVIU - inspection/verify", "Sticker issued by MVIU; roadworthiness result; inspected plate match; annual validity"],
  ["Logbook / Lease", "NTSA TIMS - ownership/verify", "Owner-driver: logbook registered to the applicant. Hired driver: lease certified by a Commissioner for Oaths naming the legal owner"],
];

const T_SLA = [
  ["Automated document verification (all 7 registries)", "Under 2 minutes end to end; each registry call under 3 seconds"],
  ["Flagged-document manual review", "Within 24 hours of flagging, during business hours"],
  ["Re-upload re-verification after a failed document", "Immediate; the registry check re-runs on upload"],
  ["Expiry reminder messages", "14 days, 7 days and 1 day before each document expiry"],
  ["Auto-suspension on expiry", "Same day, effective at midnight after the validity lapse"],
  ["Reactivation after renewal upload", "Under 5 minutes; automatic once all seven documents verify"],
];

const T_SMS = [
  ["Application received", "Msafiri: Karibu [name]! We are verifying your 7 documents against NTSA, eCitizen, DCI and IRA registries. Results shortly."],
  ["KYD Gate passed", "Msafiri: All 7 documents verified. Next step - complete your 4 induction modules, then sign the platform agreement."],
  ["Verification on hold", "Msafiri: Some documents need a compliance officer's review. We will contact you within 24 hours."],
  ["Action required", "Msafiri: [document] failed verification. Open the app to see the reason and re-upload."],
  ["Renewal reminder", "Msafiri: Your [document] expires in [n] days. Renew with [authority] and upload it in-app to avoid suspension."],
  ["Auto-suspension", "Msafiri: Your account has been suspended - [document] expired on [date]. Upload the renewal to reactivate."],
  ["Reactivated", "Msafiri: All documents valid again - you are back on the road. Karibu tena!"],
];

const T_ROLES = [
  ["Driver-applicant", "Supplies truthful documents and accurate profile data; completes induction; renews documents before expiry; enters the passenger's PIN before every trip."],
  ["Compliance officer (admin console)", "Reviews flagged documents within SLA; approves with a note or requests re-upload; may decline an application with a stated reason; may force-reactivate after a manual inspection; monitors the expiry radar."],
  ["Platform (automated)", "Runs all registry checks and cross-checks; records an immutable audit entry for every action; issues reminders at 14, 7 and 1 days; enforces auto-suspension and automatic reactivation; generates and validates boarding PINs."],
  ["Support", "Releases boarding sessions locked after three wrong PIN entries; handles appeals against rejection or suspension; escalates suspected fraud to the compliance lead."],
];

const T_DEMO = [
  ["+254722334455", "Kevin Otieno", "Active owner-driver; full 7/7 verified history with registry logs"],
  ["+254733114477", "Faith Wambui", "Submitted; run the automated verification live and continue to induction"],
  ["+254701998822", "John Kamau Mwangi", "Flagged; licence name differs from the national ID; practise manual review"],
  ["+254711456789", "Peter Njoroge", "Active; Good Conduct expires in about 9 days; advance the demo clock to see reminders and auto-suspension"],
  ["+254799887766", "Samson Barasa", "Suspended; inspection sticker lapsed; re-upload a renewal to trigger automatic reactivation"],
  ["+254734556677", "Grace Achieng", "Draft; hired-vehicle path with a certified lease agreement"],
  ["demitri@msafiri.co.ke", "Admin (Demitri)", "Compliance console; requires the second-factor access code in the prototype"],
];

const CH1 = [
  "This document defines how Msafiri onboards drivers onto its stage-based feeder cab platform for the Mombasa and Likoni-Diani corridor. It consolidates three controls that work as one system: a mandatory 7-Point Know-Your-Driver (KYD) verification gate that no applicant can bypass, an automated verification layer that checks every document against the issuing authority's registry, and an Uber-style 4-digit boarding PIN that ties every trip start to the physical presence of the booked passenger. Together these controls answer the two risks that dominate PSV operations in Kenya: unqualified or fraudulent drivers, and impostor pick-ups at crowded stages such as Likoni Ferry and Diani.",
  "The design removes manual document review from the critical path. Each of the seven mandatory documents is validated electronically against its issuing registry - the eCitizen IPRS identity register, NTSA TIMS licence and ownership records, the DCI clearance portal, the IRA policy register and the NTSA Motor Vehicle Inspection Unit. Human review is reserved for the small share of cases where automation is genuinely inconclusive, with a 24-hour service-level target. After verification, compliance becomes a monitoring problem rather than a paperwork problem: the platform tracks every document's validity window, reminds drivers at 14, 7 and 1 days before expiry, suspends automatically on the day a document lapses, and reactivates automatically once the renewal clears re-verification.",
  "This specification accompanies a clickable prototype that implements the full lifecycle. Operations staff can rehearse every scenario described here - a clean application, a failed document, a flagged name mismatch, an expiry-driven suspension and a renewal-driven reactivation - before a line of production code is written against live registries.",
];

const CH2 = [
  "The purpose of this document is to give the Msafiri product and operations teams a single, testable definition of the driver onboarding process. It fixes the mandatory document set, the automated checks applied to each document, the status model that governs what a driver may do at any moment, and the boarding PIN protocol that protects passengers at pickup. It also defines the service-level targets and the notification templates that make the process observable to drivers and auditable by the platform. Where a judgement call was required - for example the reminder cadence or the PIN lockout threshold - the decision and its rationale are stated explicitly so the team can revisit them with evidence rather than debate.",
  "The scope covers fee-paying drivers operating feeder cabs on the Msafiri platform in Mombasa, from first application through activation, and onward through renewal, suspension and reactivation. Both ownership paths are in scope: owner-drivers who hold the vehicle logbook, and hired drivers who operate under a certified lease agreement. Motorcycle (boda boda) and tuk-tuk segments are out of scope for this version; their licence classes and inspection regimes differ and will require a companion specification. Passenger onboarding, fare rules and driver earnings are covered by separate platform documents.",
  "The document set and issuing authorities in Chapter 3 follow Kenyan public service vehicle practice: identity documents are issued by the Ministry of Interior and the Immigration Department, driving licences, PSV badges and inspection certificates by the National Transport and Safety Authority (NTSA) through the TIMS and eCitizen channels, criminal-record clearances by the Directorate of Criminal Investigations (DCI), and commercial insurance must come from an underwriter registered with the Insurance Regulatory Authority (IRA). The platform does not interpret the law on the driver's behalf; it enforces the evidence. Where regulators change a requirement, the change lands as a configuration update to the relevant registry check, not as a redesign.",
];

const CH3 = [
  "Every driver-applicant must clear all seven verifications in Table 1 before the platform will allocate a single passenger. The gate is binary: six of seven is a fail. The requirement is stated to applicants in plain language during the application wizard, repeated in the confirmation SMS, and enforced again in the contract they sign at activation. Documents are captured as scans or photos in the driver app; the platform verifies them against registries, not by eye, so the quality of the capture matters mainly for later dispute handling.",
  "The seven documents divide into two groups. The first four are driver documents - identity, driving licence, PSV badge and criminal-record clearance - and they answer the question of who is behind the wheel. The last three are vehicle documents - PSV insurance, the inspection sticker and proof of ownership or lease - and they answer the question of what is being driven. Because hired drivers do not own their vehicles, document seven accepts either the logbook or a lease agreement certified by a Commissioner for Oaths naming the legal owner; the automation checks the path that matches the ownership type declared in the application.",
  "TABLE_T7DOC",
  "The gate rule is enforced at three points in time. At application, submission is impossible until all seven documents are uploaded, and activation is impossible until all seven verify. At trip time, the trip-start screen is available only to drivers whose status is Active, which by definition means all seven documents were valid at the last sweep. At any moment in between, the expiry monitor (Chapter 7) can revoke that status the day any document lapses - a driver who was legal at activation does not stay legal by assumption.",
];

const CH4 = [
  "Onboarding is modelled as an explicit state machine rather than a pile of forms. Every application is always in exactly one named status, every transition has a single owner - the driver, the automation or a compliance officer - and every transition writes an audit entry. This is what makes the process explainable: when a driver asks why they cannot take trips, the answer is a status, a reason and a timestamp, not an opinion. Table 2 defines the statuses and who controls each transition.",
  "TABLE_TLIFECYCLE",
  "Three design choices in the state machine deserve explanation. First, failed and flagged are deliberately separate: a failure is definitive and belongs to the driver to fix, while a flag is an automation verdict of not sure and belongs to the compliance officer. Conflating the two either buries officers in work they need not do or forces drivers to wait on cases a machine could have cleared. Second, there is no partial activation: a driver who is waiting on one renewal is suspended in full, because the platform cannot know which document the missing one invalidates. Third, suspension is reversible by design - the moment every document clears re-verification, the driver returns to Active without human action, which keeps the incentive to renew promptly and removes the temptation to negotiate with staff.",
];

const CH5 = [
  "Each uploaded document is verified by a direct check against the authority that issued it, not by inspecting the scan. Table 3 lists the registry integration and the specific assertions tested for each document. In the production build these are authenticated API calls to NTSA TIMS, eCitizen IPRS, the DCI clearance portal and the IRA policy register; in the prototype they are simulated with realistic request and response logging so the behaviour can be reviewed end to end. Every call is recorded with its endpoint, request identifier, latency and per-assertion results, which gives disputes a paper trail from day one.",
  "TABLE_APIS",
  "Automation is cheap enough that consistency checks between documents cost nothing, and they catch the fraud that single-document checks miss. The engine therefore additionally verifies that the holder name on the identity card, driving licence, PSV badge and good-conduct certificate agrees with the application name, allowing for ordinary reordering but not for different persons; that the insured plate on the insurance policy, the plate on the inspection sticker and the plate on the logbook or lease all match the application vehicle; and that the licence class and PSV endorsement claimed satisfy the platform's accepted set (classes B, C and E) for the vehicle type offered. A mismatch anywhere in these chains is enough to stop automatic approval.",
  "Each document check ends in exactly one of three outcomes. Verified means every assertion passed; the document is stamped with its check time and the registry response. Failed means an assertion failed definitively - an expired certificate, a licence class the platform does not accept, a policy without passenger liability, an unregistered underwriter, an adverse criminal record - and the driver is told precisely which assertion failed and what to do, because a failure the driver cannot understand is a failure the driver cannot fix. Flagged means the evidence is contradictory but not conclusively bad, typically a name that partially differs between registries; the document routes to the manual queue described in Chapter 7. An adverse criminal record is treated as a rejection rather than a re-upload case, per safety policy.",
  "Service-level targets are part of the specification, not an afterthought, because a gate this strict is only acceptable if it is fast when it works and honest when it does not. Table 4 states the targets the production build will be measured against. The two-minute end-to-end target for automated verification is what makes same-day onboarding realistic, and the 24-hour flag-review commitment is what keeps a mostly-automated process from feeling arbitrary to applicants.",
  "TABLE_SLA",
];

const CH6 = [
  "Verification establishes who the driver is; the boarding PIN establishes that the right passenger boarded. When a passenger's M-Pesa payment confirms a booking, the platform generates a unique 4-digit PIN and shows it on the passenger's phone together with the cab and driver details. The driver's trip screen cannot start the trip until that PIN is entered and matched. The PIN is per-booking, it expires with the booking, and it is never displayed to the driver in advance - the passenger shows it to the driver at the stage. The mechanics are deliberately boring: nothing to memorise, nothing to photocopy, nothing worth stealing tomorrow.",
  "The control addresses a specific, local failure mode. At busy interchanges such as Likoni Ferry and Diani, an impostor can pose as a booked passenger, board the cab and ride on someone else's fare - or a bogus driver can collect passengers who believe he is their booking. Because only the booked passenger holds the PIN for that cab on that trip, both frauds fail: a passenger without the right PIN cannot board, and a driver without the booking cannot start a trip at all, since the platform never shows him a PIN to match. The PIN also protects the e-ticket: boarding is proof of service, so fares are only earned for passengers who actually arrived.",
  "Failure handling is strict because PIN guessing is the only attack the design leaves open. A driver has three attempts to enter the PIN. On the first two errors the driver is told how many attempts remain and is asked to re-read the PIN with the passenger. On the third error the boarding session locks: the trip cannot start, support must release the session, and the incident is written to the audit log with the booking, the attempts and the timestamps. Repeated lockouts on one driver account raise a fraud signal to the compliance team. This trades a small support load for a vanishingly small chance of guessing a live PIN, which is the correct direction of error for a passenger-safety control.",
];

const CH7 = [
  "A driver who was fully legal at activation can become illegal the day any one of six dated documents lapses, so the platform treats compliance as a monitoring loop rather than a one-off event. The expiry radar in the admin console lists every active document across the fleet ordered by remaining validity, colour-codes anything inside a 30-day window, and lets an officer send an immediate reminder with one action. Reminders are also automatic: at 14, 7 and 1 day before expiry the driver receives the SMS in Table 5, phrased with the exact document, the issuing authority and the consequence of doing nothing.",
  "TABLE_SMS",
  "When a validity window passes, the sweep suspends the driver the same day, blocks the trip screen, notifies driver and admin feeds, and marks the document as expired in the compliance matrix. There is no grace period and no discretion, because a lapsed inspection sticker or an expired good-conduct certificate is precisely the risk the KYD gate exists to keep off the platform. Suspension is announced factually: which document, expired when, and what to do. The driver keeps full visibility of everything else in their account.",
  "Reactivation is automatic and evidence-based. The driver renews the document with the issuing authority, uploads the new certificate from the same document screen, and the platform re-runs the full registry check - the renewal is verified with the same rigour as the original, which closes the door on renewal-time substitution. The moment all seven documents verify again, suspension lifts, the driver and the admin feed are notified, and the audit trail records the lapse, the renewal and the reactivation as one continuous incident. No staff action is required in the happy path, so staff attention is reserved for the queue that actually needs judgement: flags, appeals and suspected fraud.",
  "Manual review exists for the residue automation cannot decide, and it is bounded. A compliance officer sees the flagged document with the exact contradiction the engine found, the full registry log behind it, and three actions: accept with a mandatory note, request re-upload with a reason that is sent to the driver, or - for applications with fatal findings such as an adverse record - decline with a stated reason the driver may appeal. Officers may also force-reactivate a suspended driver after verifying documents out of band, an override that is deliberately loud: it is named in the audit trail with the officer's identity and note. What officers cannot do is silently edit document data; corrections flow through re-upload so the evidence chain stays intact.",
];

const CH8 = [
  "The process assigns every decision to exactly one owner, which is what keeps a mostly-automated pipeline accountable. Table 6 summarises the division of labour between the driver, the platform automation, the compliance officer and support. The pattern to notice is that the platform owns anything rule-like - checks, reminders, suspension, reactivation, PIN validation - while people own anything judgement-like - flags, appeals and fraud. When staff find themselves doing rule-like work by hand, that work should be automated, and the audit trail is the evidence base for deciding what to automate next.",
  "TABLE_ROLES",
];

const CH9 = [
  "The onboarding pipeline handles some of the most sensitive data the platform will hold - national ID numbers, licence numbers, criminal-record outcomes and vehicle ownership - so its security posture is specified rather than assumed. Access follows the platform's existing role model: driver-applicants see only their own application and documents, compliance officers work in a separate console protected by two-factor authentication, and no public signup path can create an officer account. Document scans are stored encrypted and rendered only inside the compliance console; access to any driver's compliance record is scoped to that driver's own session. Data handling follows the Kenya Data Protection Act, 2019, and a named data protection officer 【Data Protection Officer name】 owns retention and subject-access requests.",
  "Audit is the second half of the posture. Every state-changing action - application submission, each registry check with its per-assertion results, each officer decision with its note, each suspension and reactivation, each PIN attempt and lockout - is written to an append-only log with actor, role, entity and timestamp. The log exists for three consumers: the driver, who is entitled to know why their application stalled; the compliance officer, who investigates disputes with evidence instead of memory; and the platform, which uses the record to detect patterns such as repeat lockouts or serial re-uploads. Production retention follows the seven-year convention commonly applied to records connected with passenger transport operations.",
];

const CH10 = [
  "The accompanying prototype implements this specification end to end so the team can rehearse it before production integration. It covers the unified login with automatic role recognition, the application wizard with all seven document forms, the animated automated-verification run against simulated registries with full request logs, the induction modules with knowledge checks, the contract e-signature, the boarding PIN flow with attempt counting and lockout, the expiry radar with a demo clock that advances days to trigger reminders and auto-suspension, the flagged-document review queue with accept, re-upload and decline actions, and the audit trail. The prototype is the executable reference for this document: where the two appear to disagree, the difference is a bug report.",
  "TABLE_DEMO",
  "Production integration proceeds in four increments. First, replace the simulated registry checks with live integrations - NTSA TIMS for licence and ownership, eCitizen IPRS for identity, the DCI clearance portal and the IRA policy register - keeping the assertion structure of this specification so the audit log survives the swap. Second, connect the SMS gateway and move the notification templates of Table 5 into production messaging with the same 14-7-1 cadence. Third, wire the boarding PIN into the live booking and M-Pesa payment flow so PIN generation follows payment confirmation, and extend it with the driver-side GPS context already designed for the platform. Fourth, run a two-week supervised pilot on the Likoni Ferry stage cluster with compliance officers working the flag queue daily, and use the audit data to tune the reminder cadence and the flag thresholds before corridor-wide rollout. Each increment ships behind the existing role-based access controls and adds no new class of personal data beyond what this specification already governs.",
];

module.exports = {
  T7DOC, T_LIFECYCLE, T_APIS, T_SLA, T_SMS, T_ROLES, T_DEMO,
  CH1, CH2, CH3, CH4, CH5, CH6, CH7, CH8, CH9, CH10,
};
