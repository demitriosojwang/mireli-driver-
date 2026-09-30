"use client";
// ─── Induction modules + platform contract signing ──────────────────────────
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { INDUCTION_MODULES, CONTRACT_CLAUSES } from "@/lib/onboarding/registry";
import { useOnboarding } from "@/lib/onboarding/store";
import type { DriverRecord } from "@/lib/onboarding/types";
import { toast } from "@/hooks/use-toast";
import { GraduationCap, FileSignature, PartyPopper, CheckCircle2, RotateCcw } from "lucide-react";

export function Induction({ driver }: { driver: DriverRecord }) {
  const passInductionModule = useOnboarding((s) => s.passInductionModule);
  const beginInduction = useOnboarding((s) => s.beginInduction);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const done = driver.induction?.modulesDone ?? [];
  const started = Boolean(driver.induction);

  if (driver.status === "verified" && !started) {
    return (
      <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-white">
        <CardContent className="p-5 text-center">
          <GraduationCap className="h-8 w-8 text-teal-600 mx-auto" />
          <h3 className="font-semibold text-slate-900 mt-2">KYD Gate passed — final step: induction</h3>
          <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
            Four short modules with a quick check after each: stage rules, passenger safety, the boarding PIN
            protocol, and your document compliance duties. About 10 minutes total.
          </p>
          <Button className="mt-4 bg-teal-600 hover:bg-teal-700" onClick={() => beginInduction()}>
            Begin induction
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-teal-600" /> Induction — {done.length}/4 modules
          </h3>
        </div>
        <Progress value={(done.length / 4) * 100} className="mt-2 h-1.5" />
      </div>

      {INDUCTION_MODULES.map((m, idx) => {
        const passed = done.includes(idx);
        const choice = picked[idx];
        return (
          <Card key={m.title} className={passed ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200"}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900">{m.title}</h4>
                {passed && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
              </div>
              <p className="text-xs text-slate-600 mt-1.5">{m.body}</p>
              {!passed && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-medium text-slate-700">{m.quiz.q}</p>
                  {m.quiz.options.map((opt, oi) => (
                    <button
                      key={oi}
                      className={`w-full text-left text-xs rounded-lg border px-3 py-2 transition-colors ${
                        choice === oi
                          ? oi === m.quiz.answer
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border-red-200 bg-red-50 text-red-700"
                          : "border-slate-200 hover:border-teal-300 hover:bg-teal-50/50"
                      }`}
                      onClick={() => {
                        if (choice !== undefined) return;
                        setPicked((p) => ({ ...p, [idx]: oi }));
                        if (oi === m.quiz.answer) {
                          setTimeout(() => passInductionModule(idx), 450);
                        } else {
                          toast({ title: "Not quite", description: "Re-read the module and pick again." });
                          setTimeout(() => setPicked((p) => ({ ...p, [idx]: undefined as unknown as number })), 700);
                        }
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function Contract({ driver }: { driver: DriverRecord }) {
  const signContract = useOnboarding((s) => s.signContract);
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);

  if (driver.status === "active") {
    return (
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
        <CardContent className="p-5 text-center">
          <PartyPopper className="h-8 w-8 text-emerald-600 mx-auto" />
          <h3 className="font-semibold text-slate-900 mt-2">You are live, {driver.contract?.signedName ?? driver.profile.fullName}!</h3>
          <p className="text-sm text-slate-600 mt-1">
            Contract signed {driver.contract?.signedAt ? new Date(driver.contract.signedAt).toLocaleDateString("en-KE") : ""}.
            Your cab {driver.vehicle?.plate} is visible to passengers. Keep your 7 documents valid — the platform
            auto-suspends the day any of them lapse.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-teal-600" /> Msafiri Driver Partner Agreement
          </h3>
          <p className="text-xs text-slate-500 mt-1">Read the full terms below, then sign electronically.</p>
          <ol className="mt-3 space-y-2">
            {CONTRACT_CLAUSES.map((c, i) => (
              <li key={i} className="flex gap-2 text-xs text-slate-700">
                <span className="font-semibold text-slate-400 shrink-0">{i + 1}.</span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <Card className="border-slate-200">
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600" htmlFor="sig">Type your full name to sign</label>
            <Input id="sig" className="h-10" placeholder={driver.profile.fullName} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
            <Checkbox checked={agree} onCheckedChange={(v) => setAgree(Boolean(v))} className="mt-0.5" />
            I confirm all uploaded documents are genuine and I accept the agreement, the 12% commission and the
            auto-suspension policy.
          </label>
          <Button
            className="w-full h-10 bg-emerald-600 hover:bg-emerald-700"
            disabled={!agree || name.trim().length < 3}
            onClick={() => signContract(name.trim())}
          >
            Sign &amp; go live
          </Button>
          {(!agree || name.trim().length < 3) && (
            <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
              <RotateCcw className="h-3 w-3" /> Sign after reading — activation is instant.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
