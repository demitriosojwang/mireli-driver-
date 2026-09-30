"use client";
// ─── Driver application shell ───────────────────────────────────────────────
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DOC_BY_KIND } from "@/lib/onboarding/registry";
import { useOnboarding } from "@/lib/onboarding/store";
import type { DriverRecord, DocKind } from "@/lib/onboarding/types";
import { DocForm } from "./DocForm";
import Wizard from "./Wizard";
import VerificationRunner from "./VerificationRunner";
import DriverOps from "./DriverOps";
import { Induction, Contract } from "./Induction";
import { StatusBadge, DocBadge, ExpiryChip, DocIcon, fmtDate, fmtTime } from "./shared";
import { toast } from "@/hooks/use-toast";
import {
  Car, LogOut, ShieldCheck, RefreshCcw, BellRing, MessageSquare, GaugeCircle, CircleAlert,
} from "lucide-react";

const NEXT_STEP: Record<DriverRecord["status"], string> = {
  draft: "Complete your application below — profile, then the 7 documents.",
  submitted: "Automated verification is running against the registries…",
  verifying: "Automated verification is running against the registries…",
  action_required: "Some documents failed. Tap the red cards to see why and re-upload.",
  flagged: "A compliance officer is reviewing flagged items — expect feedback within 24h.",
  verified: "Asante! Now complete your 4 induction modules.",
  induction: "Finish the remaining induction modules.",
  contract: "Last step — read and sign the partner agreement.",
  active: "You are trip-ready. Check in on the Drive tab to receive passenger bookings.",
  suspended: "Trips blocked — renew the expired documents and re-upload to reactivate.",
  rejected: "Application declined. Contact support to appeal.",
  deactivated: "Account deactivated.",
};

export default function DriverApp() {
  const session = useOnboarding((s) => s.session);
  const driver = useOnboarding((s) => s.drivers.find((d) => d.id === s.session?.driverId));
  const allNotifications = useOnboarding((s) => s.notifications);
  const logout = useOnboarding((s) => s.logout);
  const saveDocument = useOnboarding((s) => s.saveDocument);
  const reuploadDocument = useOnboarding((s) => s.reuploadDocument);
  const [tabOverride, setTabOverride] = useState<string | null>(null);
  const [uploadKind, setUploadKind] = useState<DocKind | null>(null);

  // derive default tab from status; reset override when status changes (render-time adjustment)
  const defaultTab = !driver
    ? "kyd"
    : driver.status === "draft"
      ? "apply"
      : driver.status === "active"
        ? "drive"
        : ["verified", "induction", "contract"].includes(driver.status)
          ? "grow"
          : "kyd";
  const [lastStatusId, setLastStatusId] = useState<string | null>(driver ? `${driver.id}:${driver.status}` : null);
  const currentStatusId = driver ? `${driver.id}:${driver.status}` : null;
  if (currentStatusId !== lastStatusId) {
    setLastStatusId(currentStatusId);
    setTabOverride(null);
  }
  const tab = tabOverride ?? defaultTab;

  if (!driver || !session) return null;

  const verifiedCount = driver.documents.filter((d) => d.status === "verified").length;
  const showRunner = ["submitted", "action_required"].includes(driver.status) || driver.documents.some((d) => d.status === "uploaded");
  const isDraft = driver.status === "draft";
  const showGrow = ["verified", "induction", "contract", "active"].includes(driver.status);
  const showTrip = driver.status === "active" || driver.status === "suspended";
  const myNotifications = allNotifications.filter((n) => n.driverId === driver.id);

  const expiryBoard = [...driver.documents]
    .filter((d) => d.expiresAt)
    .sort((a, b) => new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime());

  const handleDocSave = (kind: DocKind, payload: Parameters<typeof saveDocument>[1]) => {
    if (isDraft) saveDocument(kind, payload);
    else reuploadDocument(kind, payload);
    setUploadKind(null);
    toast({
      title: isDraft ? "Document saved" : "Re-upload received",
      description: isDraft ? "It will be verified when you submit." : "Automated re-verification is starting.",
    });
  };

  return (
    <div className="min-h-screen bg-[#f7f8f7] flex flex-col">
      {/* header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
            <Car className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 leading-tight truncate">{driver.profile.fullName}</p>
            <p className="text-[11px] text-slate-400 leading-tight">{driver.vehicle ? `${driver.vehicle.plate} · ${driver.vehicle.seats} seats` : session.identifier}</p>
          </div>
          <StatusBadge status={driver.status} />
          <Button variant="ghost" size="sm" onClick={logout} aria-label="Log out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 space-y-4">
        {/* hero */}
        <Card className="border-slate-200 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-0">
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="font-semibold">7-Point KYD Gate</h2>
              <span className="ml-auto text-sm font-bold">{verifiedCount}/7</span>
            </div>
            <Progress value={(verifiedCount / 7) * 100} className="mt-3 h-2 bg-emerald-500/40" />
            <p className="mt-3 text-sm text-emerald-50">{NEXT_STEP[driver.status]}</p>
            {driver.status === "suspended" && driver.suspensionReason && (
              <p className="mt-2 text-xs bg-red-500/30 rounded px-2 py-1 inline-flex items-center gap-1.5">
                <CircleAlert className="h-3.5 w-3.5" /> {driver.suspensionReason}
              </p>
            )}
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={(v) => setTabOverride(v)}>
          <TabsList className={`grid w-full ${driver.status === "active" ? "grid-cols-5" : showGrow || showTrip ? "grid-cols-4" : "grid-cols-3"} h-10`}>
            <TabsTrigger value="kyd" className="text-xs">KYD Gate</TabsTrigger>
            <TabsTrigger value="apply" className="text-xs">Application</TabsTrigger>
            <TabsTrigger value="renew" className="text-xs">Renewals</TabsTrigger>
            {showTrip && (
              <TabsTrigger value="drive" className="text-xs">Drive</TabsTrigger>
            )}
            {showGrow && <TabsTrigger value="grow" className="text-xs">Induction</TabsTrigger>}
          </TabsList>

          {/* ── KYD GATE ── */}
          <TabsContent value="kyd" className="space-y-3 mt-3">
            {showRunner && !isDraft && <VerificationRunner driver={driver} />}

            {driver.status === "rejected" && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-red-800">Application declined</p>
                  <p className="text-xs text-red-700 mt-1">{driver.rejectionReason}</p>
                </CardContent>
              </Card>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              {driver.documents.map((doc) => {
                const req = DOC_BY_KIND[doc.kind];
                const bad = doc.status === "failed" || doc.status === "expired";
                const warn = doc.status === "flagged";
                return (
                  <Card key={doc.kind} className={`border ${bad ? "border-red-200 bg-red-50/40" : warn ? "border-yellow-200 bg-yellow-50/40" : doc.status === "verified" ? "border-emerald-200" : "border-slate-200"} bg-white`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2.5">
                        <span className="text-lg leading-none mt-0.5"><DocIcon kind={doc.kind} /></span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 leading-tight">{req.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{req.authority}</p>
                        </div>
                        <DocBadge status={doc.status} />
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 font-mono truncate max-w-[55%]">{doc.docNumber ?? "—"}</span>
                        <ExpiryChip expiresAt={doc.expiresAt} />
                      </div>
                      {(doc.failureReason || doc.flagReason || doc.adminNote) && (
                        <p className={`mt-2 text-[11px] rounded px-2 py-1 ${bad ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-800"}`}>
                          {doc.failureReason ?? doc.flagReason ?? doc.adminNote}
                        </p>
                      )}
                      {(isDraft && doc.status === "missing") || bad ? (
                        <Button size="sm" variant={bad ? "default" : "outline"} className={`mt-3 w-full h-8 text-xs ${bad ? "bg-red-600 hover:bg-red-700" : ""}`} onClick={() => setUploadKind(doc.kind)}>
                          <RefreshCcw className="h-3 w-3 mr-1.5" /> {bad ? "Re-upload with renewal" : "Upload document"}
                        </Button>
                      ) : doc.status === "verified" ? (
                        <p className="mt-2 text-[10px] text-emerald-600">Checked {doc.checkedAt ? fmtTime(doc.checkedAt) : ""} via {req.api.name}</p>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ── APPLICATION (wizard) ── */}
          <TabsContent value="apply" className="mt-3">
            {isDraft ? (
              <Wizard driver={driver} onSubmitted={() => setTabOverride("kyd")} />
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-sm text-slate-500">
                  Application submitted on {fmtDate(driver.submittedAt)}. Use the KYD Gate tab for document status and re-uploads.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── RENEWALS ── */}
          <TabsContent value="renew" className="space-y-3 mt-3">
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  <GaugeCircle className="h-4 w-4 text-emerald-600" /> Expiry board
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Documents sorted by remaining validity. Renewals uploaded before expiry day keep you on the road.</p>
                <div className="mt-3 space-y-1.5">
                  {expiryBoard.map((doc) => (
                    <div key={doc.kind} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
                      <DocIcon kind={doc.kind} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">{DOC_BY_KIND[doc.kind].short}</p>
                        <p className="text-[10px] text-slate-400">expires {fmtDate(doc.expiresAt)}</p>
                      </div>
                      <ExpiryChip expiresAt={doc.expiresAt} />
                      <DocBadge status={doc.status} />
                      {(doc.status === "expired" || doc.status === "failed") && (
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setUploadKind(doc.kind)}>Renew</Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="p-4">
                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-emerald-600" /> Notifications &amp; SMS log
                </h3>
                {myNotifications.length === 0 ? (
                  <p className="text-xs text-slate-400 mt-2">Nothing yet — updates arrive here as your application moves.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {myNotifications.slice(0, 12).map((n) => (
                      <div key={n.id} className="flex gap-2.5 rounded-lg border border-slate-100 bg-white px-3 py-2">
                        {n.channel === "sms" ? <MessageSquare className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" /> : <BellRing className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-800">{n.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{n.body}</p>
                          <p className="text-[10px] text-slate-300 mt-0.5">{fmtDate(n.at)} {fmtTime(n.at)} · {n.channel.toUpperCase()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── DRIVE — trip operations ── */}
          {showTrip && (
            <TabsContent value="drive" className="mt-3">
              <DriverOps />
            </TabsContent>
          )}

          {/* ── INDUCTION / CONTRACT ── */}
          {showGrow && (
            <TabsContent value="grow" className="mt-3">
              {["verified", "induction"].includes(driver.status) ? <Induction driver={driver} /> : <Contract driver={driver} />}
            </TabsContent>
          )}
        </Tabs>
      </main>

      <footer className="py-4 text-center text-[11px] text-slate-400">
        Msafiri · 7-Point KYD Gate · PIN-verified boardings · Mombasa
      </footer>

      {/* upload / re-upload dialog */}
      <Dialog open={uploadKind !== null} onOpenChange={(o) => !o && setUploadKind(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{uploadKind ? DOC_BY_KIND[uploadKind].name : ""}</DialogTitle>
            <DialogDescription>
              {uploadKind ? `${DOC_BY_KIND[uploadKind].authority} · ${DOC_BY_KIND[uploadKind].validity} · ${DOC_BY_KIND[uploadKind].purpose}` : ""}
            </DialogDescription>
          </DialogHeader>
          {uploadKind && (
            <DocForm
              kind={uploadKind}
              driver={driver}
              existing={driver.documents.find((d) => d.kind === uploadKind)}
              onSave={(p) => handleDocSave(uploadKind, p)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
