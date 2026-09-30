"use client";
// ─── Driver application wizard (draft stage) ────────────────────────────────
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOC_BY_KIND } from "@/lib/onboarding/registry";
import { useOnboarding } from "@/lib/onboarding/store";
import type { DriverRecord } from "@/lib/onboarding/types";
import { DocForm } from "./DocForm";
import { DocBadge, DocIcon } from "./shared";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, ChevronRight, IdCard, CarFront, SendHorizonal } from "lucide-react";

const STAGES = ["Likoni Ferry Stage", "Shelly Beach Stage", "Diani Beach Stage", "Ukunda Stage", "Msambweni Stage", "Pemba Pier Stage"];

const StepHead = ({ n, title, done }: { n: number; title: string; done: boolean }) => (
  <div className="flex items-center gap-2">
    <span className={`h-5 w-5 rounded-full text-[11px] font-bold flex items-center justify-center ${done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"}`}>
      {done ? "✓" : n}
    </span>
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
  </div>
);

export default function Wizard({ driver, onSubmitted }: { driver: DriverRecord; onSubmitted: () => void }) {
  const upsertProfile = useOnboarding((s) => s.upsertProfile);
  const upsertVehicle = useOnboarding((s) => s.upsertVehicle);
  const saveDocument = useOnboarding((s) => s.saveDocument);
  const submitApplication = useOnboarding((s) => s.submitApplication);
  const [step, setStep] = useState<"profile" | "docs" | "review">("profile");

  const [profile, setProfile] = useState({
    fullName: driver.profile.fullName === "New Driver" ? "" : driver.profile.fullName,
    email: driver.profile.email ?? "",
    idNumber: driver.profile.idNumber ?? "",
    baseStage: driver.profile.baseStage ?? "Likoni Ferry Stage",
  });
  const [vehicle, setVehicle] = useState({
    plate: driver.vehicle?.plate ?? "",
    model: driver.vehicle?.model ?? "",
    seats: String(driver.vehicle?.seats ?? 4),
    ownerType: driver.vehicle?.ownerType ?? ("owner" as "owner" | "hired"),
    ownerName: driver.vehicle?.ownerName ?? "",
  });

  const profileValid = profile.fullName.trim().length >= 3 && profile.idNumber.trim().length >= 6 && vehicle.plate.trim().length >= 5;
  const uploadedCount = driver.documents.filter((d) => d.status !== "missing").length;
  const isHired = vehicle.ownerType === "hired";

  return (
    <div className="space-y-4">
      {/* step 1 — profile & vehicle */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <StepHead n={1} title="Profile & vehicle" done={profileValid} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Full name (as on ID)</Label>
              <Input className="h-9" placeholder="e.g. Ali Hassan Mwinyi" value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} onBlur={() => profile.fullName.trim() && upsertProfile({ fullName: profile.fullName.trim() })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">National ID number</Label>
              <Input className="h-9 font-mono" placeholder="8 digits" value={profile.idNumber} onChange={(e) => setProfile({ ...profile, idNumber: e.target.value.replace(/\D/g, "") })} onBlur={() => profile.idNumber && upsertProfile({ idNumber: profile.idNumber })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Email (optional)</Label>
              <Input className="h-9" placeholder="you@example.com" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} onBlur={() => upsertProfile({ email: profile.email || undefined })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Home stage</Label>
              <Select value={profile.baseStage} onValueChange={(v) => { setProfile({ ...profile, baseStage: v }); upsertProfile({ baseStage: v }); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Number plate</Label>
              <Input className="h-9 font-mono uppercase" placeholder="KAA 001A" value={vehicle.plate} onChange={(e) => setVehicle({ ...vehicle, plate: e.target.value.toUpperCase() })} onBlur={() => vehicle.plate && upsertVehicle({ plate: vehicle.plate })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Vehicle model</Label>
              <Input className="h-9" placeholder="e.g. Toyota Probox" value={vehicle.model} onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })} onBlur={() => vehicle.model && upsertVehicle({ model: vehicle.model })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Passenger seats</Label>
              <Select value={vehicle.seats} onValueChange={(v) => { setVehicle({ ...vehicle, seats: v }); upsertVehicle({ seats: Number(v) }); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{["4", "5", "6", "7", "8", "9", "14"].map((s) => <SelectItem key={s} value={s}>{s} seats</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Vehicle ownership</Label>
              <Select value={vehicle.ownerType} onValueChange={(v) => { setVehicle({ ...vehicle, ownerType: v as "owner" | "hired" }); upsertVehicle({ ownerType: v as "owner" | "hired" }); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">I own the vehicle (logbook)</SelectItem>
                  <SelectItem value="hired">I hired it (lease agreement)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isHired && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-slate-500">Legal owner (lessor) name</Label>
                <Input className="h-9" placeholder="Owner as per logbook" value={vehicle.ownerName} onChange={(e) => setVehicle({ ...vehicle, ownerName: e.target.value })} onBlur={() => vehicle.ownerName && upsertVehicle({ ownerName: vehicle.ownerName })} />
              </div>
            )}
          </div>
          <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" disabled={!profileValid} onClick={() => { upsertProfile({ fullName: profile.fullName.trim(), idNumber: profile.idNumber, email: profile.email || undefined, baseStage: profile.baseStage }); upsertVehicle({ plate: vehicle.plate, model: vehicle.model, seats: Number(vehicle.seats), ownerType: vehicle.ownerType, ownerName: isHired ? vehicle.ownerName : undefined }); setStep("docs"); }}>
            Continue to documents <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          {!profileValid && <p className="text-[11px] text-slate-400 mt-2">Name, ID number and plate are required before documents.</p>}
        </CardContent>
      </Card>

      {/* step 2 — documents */}
      <Card className={`border-slate-200 ${step === "profile" ? "opacity-50 pointer-events-none" : ""}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <StepHead n={2} title="Upload the 7 KYD documents" done={uploadedCount === 7} />
            <span className="text-xs text-slate-400">{uploadedCount}/7 uploaded</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Each document is verified automatically against the issuing registry — NTSA, eCitizen, DCI, IRA. Nothing is checked manually.
          </p>
          <Accordion type="single" collapsible className="mt-3">
            {driver.documents.map((doc) => {
              const req = DOC_BY_KIND[doc.kind];
              return (
                <AccordionItem key={doc.kind} value={doc.kind}>
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex items-center gap-2.5 text-left">
                      <DocIcon kind={doc.kind} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 leading-tight">{req.name}</p>
                        <p className="text-[11px] text-slate-400">{req.authority} · {req.validity}</p>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <DocBadge status={doc.status} />
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <DocForm
                      kind={doc.kind}
                      driver={driver}
                      existing={doc.status !== "missing" ? doc : undefined}
                      onSave={(payload) => {
                        saveDocument(doc.kind, payload);
                        toast({ title: `${req.short} saved`, description: "Stored encrypted; verified on submission." });
                      }}
                    />
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
          <Button className="mt-4" variant="outline" disabled={uploadedCount < 7} onClick={() => setStep("review")}>
            Review application <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      {/* step 3 — review & submit */}
      <Card className={`border-slate-200 ${uploadedCount < 7 ? "opacity-50 pointer-events-none" : ""}`}>
        <CardContent className="p-4">
          <StepHead n={3} title="Review & submit" done={false} />
          <div className="mt-3 space-y-1.5">
            {driver.documents.map((doc) => (
              <div key={doc.kind} className="flex items-center gap-2 text-sm">
                {doc.status === "missing" ? <span className="h-4 w-4 rounded border border-slate-300" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                <span className="text-slate-700">{DOC_BY_KIND[doc.kind].name}</span>
                <span className="ml-auto"><DocBadge status={doc.status} /></span>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
            <p className="flex items-center gap-1.5 font-medium text-slate-700"><IdCard className="h-3.5 w-3.5" /> {profile.fullName || driver.profile.fullName} · ID {profile.idNumber || driver.profile.idNumber}</p>
            <p className="flex items-center gap-1.5 mt-1"><CarFront className="h-3.5 w-3.5" /> {vehicle.plate || driver.vehicle?.plate} · {vehicle.model || driver.vehicle?.model} · {vehicle.seats} seats · {isHired ? `hired from ${vehicle.ownerName}` : "owner-driver"}</p>
          </div>
          <Button
            className="mt-4 w-full h-11 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => {
              submitApplication();
              toast({ title: "Application submitted", description: "Automated verification is starting now." });
              onSubmitted();
            }}
          >
            <SendHorizonal className="h-4 w-4 mr-2" /> Submit for automated verification
          </Button>
          <p className="text-[11px] text-slate-400 text-center mt-2">
            By submitting you confirm the documents are genuine. False documents = permanent ban.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
