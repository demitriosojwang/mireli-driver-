"use client";
// ─── Animated automated verification run ────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DOC_BY_KIND } from "@/lib/onboarding/registry";
import { useOnboarding } from "@/lib/onboarding/store";
import type { DriverRecord, DocKind } from "@/lib/onboarding/types";
import { DocBadge } from "./shared";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, ShieldCheck, RefreshCw } from "lucide-react";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function VerificationRunner({ driver }: { driver: DriverRecord }) {
  const [runId, setRunId] = useState(0);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<DocKind | null>(null);
  const autoRef = useRef(false);
  const cancelledRef = useRef(false);

  const pending = driver.documents.filter((d) => d.status === "uploaded");
  const processed = driver.documents.filter((d) => ["verified", "failed", "flagged", "expired"].includes(d.status)).length;

  // auto-start shortly after mount when the app was just submitted (async setState)
  useEffect(() => {
    if (!autoRef.current && ["submitted", "action_required"].includes(driver.status) && pending.length > 0) {
      autoRef.current = true;
      const t = setTimeout(() => setRunId((id) => id + 1), 500);
      return () => clearTimeout(t);
    }
  }, [driver.status, pending.length]);

  // the verification loop — every setState happens after an await (never sync in effect body)
  useEffect(() => {
    if (runId === 0) return;
    cancelledRef.current = false;
    const cancelled = () => cancelledRef.current;
    const run = async () => {
      setRunning(true);
      await sleep(60);
      const drv = useOnboarding.getState().drivers.find((d) => d.id === driver.id);
      if (drv) {
        for (const doc of drv.documents) {
          if (cancelled()) return;
          if (doc.status !== "uploaded") continue;
          setCurrent(doc.kind);
          await sleep(750 + Math.random() * 500);
          if (cancelled()) return;
          // store advances the state machine itself (auto-finalizes after the last doc)
          useOnboarding.getState().verifyDocument(driver.id, doc.kind);
          await sleep(350);
          if (cancelled()) return;
          setCurrent(null);
        }
      }
      setCurrent(null);
      setRunning(false);
    };
    run();
    return () => {
      cancelledRef.current = true;
    };
  }, [runId, driver.id]);

  const allProcessed = processed === 7 && !running;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            7-Point KYD verification
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated checks against NTSA TIMS · eCitizen IPRS · DCI · IRA · NTSA MVIU
          </p>
        </div>
        {!running && pending.length > 0 && (
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setRunId((id) => id + 1)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Run checks
          </Button>
        )}
        {running && <Badge className="bg-amber-100 text-amber-800 border-amber-200">Running…</Badge>}
      </div>

      <Progress value={Math.round((processed / 7) * 100)} className="mt-3 h-1.5" />

      <div className="mt-3 space-y-1">
        {driver.documents.map((doc) => {
          const req = DOC_BY_KIND[doc.kind];
          const isCurrent = current === doc.kind;
          const log = driver.apiLogs.find((l) => l.docKind === doc.kind);
          return (
            <div key={doc.kind} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
              <span className="w-5 text-center text-[11px] font-semibold text-slate-400">{req.order}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{req.name}</p>
                {isCurrent ? (
                  <p className="text-[11px] font-mono text-amber-600 animate-pulse truncate">
                    POST {req.api.endpoint} …
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 truncate">
                    {doc.status === "verified" && log ? `${req.api.name} · ${log.latencyMs}ms · ${log.httpStatus} OK` : req.api.name}
                    {doc.failureReason ? ` — ${doc.failureReason}` : doc.flagReason ? ` — ${doc.flagReason}` : ""}
                  </p>
                )}
              </div>
              {isCurrent ? (
                <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
              ) : doc.status === "verified" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : doc.status === "failed" || doc.status === "expired" ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : doc.status === "flagged" ? (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              ) : (
                <DocBadge status={doc.status} />
              )}
            </div>
          );
        })}
      </div>

      {allProcessed && (
        <div className="mt-3">
          {driver.status === "verified" && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
              <p className="text-sm font-semibold text-emerald-800">7-Point KYD Gate passed</p>
              <p className="text-xs text-emerald-700 mt-0.5">All registries cleared. Proceed to induction — see the Induction tab.</p>
            </div>
          )}
          {driver.status === "flagged" && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
              <p className="text-sm font-semibold text-yellow-800">Routed to compliance review</p>
              <p className="text-xs text-yellow-700 mt-0.5">A compliance officer reviews flagged documents within 24 hours.</p>
            </div>
          )}
          {driver.status === "action_required" && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
              <p className="text-sm font-semibold text-orange-800">Some documents failed — re-upload needed</p>
              <p className="text-xs text-orange-700 mt-0.5">Tap the red cards below to see reasons and re-upload.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
