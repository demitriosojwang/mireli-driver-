"use client";
// ─── Admin: single-driver compliance detail ─────────────────────────────────
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DOC_BY_KIND } from "@/lib/onboarding/registry";
import { useOnboarding } from "@/lib/onboarding/store";
import type { DocKind } from "@/lib/onboarding/types";
import { StatusBadge, DocBadge, ExpiryChip, DocIcon, fmtDate, fmtTime } from "./shared";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, AlertTriangle, BellRing, ShieldOff, ShieldCheck, FileX2, ChevronDown } from "lucide-react";

export default function AdminDetail({ driverId }: { driverId: string }) {
  const driver = useOnboarding((s) => s.drivers.find((d) => d.id === driverId));
  const reviewDocument = useOnboarding((s) => s.reviewDocument);
  const rejectApplication = useOnboarding((s) => s.rejectApplication);
  const forceReactivate = useOnboarding((s) => s.forceReactivate);
  const sendReminderNow = useOnboarding((s) => s.sendReminderNow);
  const [reviewKind, setReviewKind] = useState<{ kind: DocKind; decision: "approve" | "reupload" } | null>(null);
  const [note, setNote] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!driver) return null;

  const flags = driver.documents.filter((d) => d.status === "flagged");
  const expiring = driver.documents.filter(
    (d) => d.expiresAt && d.status === "verified" && (new Date(d.expiresAt).getTime() - Date.now()) / 86400000 <= 30,
  );

  return (
    <div className="space-y-4">
      {/* identity */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[200px]">
              <p className="font-semibold text-slate-900">{driver.profile.fullName}</p>
              <p className="text-xs text-slate-500">
                {driver.profile.phone} · ID {driver.profile.idNumber ?? "—"} · base {driver.profile.baseStage ?? "—"}
              </p>
              <p className="text-xs text-slate-500">
                {driver.vehicle ? `${driver.vehicle.plate} · ${driver.vehicle.model} · ${driver.vehicle.seats} seats · ${driver.vehicle.ownerType === "hired" ? `hired from ${driver.vehicle.ownerName}` : "owner-driver"}` : "No vehicle yet"}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Applied {fmtDate(driver.submittedAt ?? driver.createdAt)}
                {driver.activatedAt ? ` · active since ${fmtDate(driver.activatedAt)}` : ""}
                {driver.suspendedAt ? ` · suspended ${fmtDate(driver.suspendedAt)}` : ""}
              </p>
            </div>
            <StatusBadge status={driver.status} />
          </div>
          {(driver.suspensionReason || driver.rejectionReason) && (
            <p className="mt-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded px-2 py-1">
              {driver.suspensionReason ?? driver.rejectionReason}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {driver.status === "suspended" && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { forceReactivate(driverId); toast({ title: "Driver reactivated" }); }}>
                <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Force reactivate
              </Button>
            )}
            {expiring.length > 0 && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { expiring.forEach((d) => sendReminderNow(driverId, d.kind)); toast({ title: "Renewal SMS sent", description: `${expiring.length} document reminder(s) queued.` }); }}>
                <BellRing className="h-3.5 w-3.5 mr-1" /> Send renewal reminders
              </Button>
            )}
            {["submitted", "action_required", "flagged", "verified"].includes(driver.status) && (
              <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => { setRejectOpen(true); }}>
                <FileX2 className="h-3.5 w-3.5 mr-1" /> Decline application
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* compliance matrix */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-900">Compliance matrix — 7-Point KYD Gate</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-200">
                  <th className="py-2 pr-2 font-medium">#</th>
                  <th className="py-2 pr-2 font-medium">Document</th>
                  <th className="py-2 pr-2 font-medium">Issuing authority</th>
                  <th className="py-2 pr-2 font-medium">Validity</th>
                  <th className="py-2 pr-2 font-medium">Status</th>
                  <th className="py-2 pr-2 font-medium">Expires</th>
                  <th className="py-2 font-medium">Review</th>
                </tr>
              </thead>
              <tbody>
                {driver.documents.map((doc) => {
                  const req = DOC_BY_KIND[doc.kind];
                  const needsReview = doc.status === "flagged" || doc.status === "failed";
                  return (
                    <tr key={doc.kind} className="border-b border-slate-100 align-top">
                      <td className="py-2.5 pr-2 text-slate-400">{req.order}</td>
                      <td className="py-2.5 pr-2">
                        <span className="flex items-center gap-1.5 font-medium text-slate-800"><DocIcon kind={doc.kind} /> {req.short}</span>
                        <span className="block text-[10px] text-slate-400 font-mono">{doc.docNumber ?? "—"}</span>
                      </td>
                      <td className="py-2.5 pr-2 text-slate-500 max-w-[160px]">{req.authority}</td>
                      <td className="py-2.5 pr-2 text-slate-500">{req.validity}</td>
                      <td className="py-2.5 pr-2"><DocBadge status={doc.status} /></td>
                      <td className="py-2.5 pr-2"><ExpiryChip expiresAt={doc.expiresAt} /></td>
                      <td className="py-2.5">
                        {needsReview ? (
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700" onClick={() => { setReviewKind({ kind: doc.kind, decision: "approve" }); setNote(""); }}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Accept
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] text-orange-600 border-orange-200" onClick={() => { setReviewKind({ kind: doc.kind, decision: "reupload" }); setNote(""); }}>
                              <XCircle className="h-3 w-3 mr-1" /> Re-upload
                            </Button>
                          </div>
                        ) : doc.status === "verified" ? (
                          <span className="text-[10px] text-slate-400">auto-verified</span>
                        ) : doc.adminNote ? (
                          <span className="text-[10px] text-slate-400">{doc.adminNote}</span>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {driver.flagReasons.length > 0 && (
            <div className="mt-2 text-[11px] text-yellow-800 bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5">
              {driver.flagReasons.join(" · ")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* api logs */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-900">Registry API call log</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Every automated check is recorded for audit and dispute handling.</p>
          {driver.apiLogs.length === 0 ? (
            <p className="text-xs text-slate-400 mt-2">No checks yet.</p>
          ) : (
            <Accordion type="single" collapsible className="mt-2">
              {driver.apiLogs.slice(0, 12).map((log) => (
                <AccordionItem key={log.id} value={log.id}>
                  <AccordionTrigger className="py-2.5 hover:no-underline">
                    <div className="flex items-center gap-2 text-left">
                      {log.outcome === "verified" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : log.outcome === "failed" ? <XCircle className="h-3.5 w-3.5 text-red-500" /> : <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />}
                      <span className="text-xs font-medium text-slate-800">{DOC_BY_KIND[log.docKind].short}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{log.httpStatus}</Badge>
                      <span className="text-[10px] text-slate-400">{log.api} · {log.latencyMs}ms · {fmtTime(log.at)}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 font-mono text-[11px] text-slate-600">
                      <p>{log.method} https://{log.endpoint}</p>
                      <p>x-request-id: {log.requestId}</p>
                      <p className="mt-1.5 font-sans text-slate-700">→ {log.summary}</p>
                      <ul className="mt-1.5 font-sans space-y-0.5">
                        {log.checks.map((c, i) => (
                          <li key={i} className="flex gap-1.5">
                            {c.pass ? <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" /> : <XCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />}
                            <span><b>{c.label}:</b> {c.detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* review dialog */}
      {reviewKind && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setReviewKind(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-900 text-sm">
              {reviewKind.decision === "approve" ? "Accept flagged document" : "Request re-upload"}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {DOC_BY_KIND[reviewKind.kind].name} — {driver.profile.fullName}
            </p>
            <Textarea className="mt-3 text-sm" rows={3} placeholder={reviewKind.decision === "approve" ? "Note (optional) — e.g. TIMS name updated after marriage certificate seen" : "Reason sent to the driver — e.g. Scan is blurred, re-capture in good light"} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setReviewKind(null)}>Cancel</Button>
              <Button
                size="sm"
                className={reviewKind.decision === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-orange-600 hover:bg-orange-700"}
                onClick={() => {
                  reviewDocument(driverId, reviewKind.kind, reviewKind.decision, note);
                  setReviewKind(null);
                  toast({ title: reviewKind.decision === "approve" ? "Document accepted" : "Re-upload requested", description: "Driver notified by SMS." });
                }}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* reject dialog */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setRejectOpen(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2"><ShieldOff className="h-4 w-4 text-red-500" /> Decline application</h3>
            <p className="text-xs text-slate-500 mt-1">The driver is notified with the reason and may appeal.</p>
            <Textarea className="mt-3 text-sm" rows={3} placeholder="Reason — e.g. Adverse criminal record per safety policy 4.1" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" disabled={reason.trim().length < 5} onClick={() => { rejectApplication(driverId, reason.trim()); setRejectOpen(false); setReason(""); toast({ title: "Application declined" }); }}>
                Decline
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
