"use client";
// ─── Unified Login (Msafiri pattern: role detected from identifier) ─────────
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ShieldCheck, Smartphone, KeyRound, ChevronLeft, UserCheck, Car, Landmark, RefreshCcw,
} from "lucide-react";
import { useOnboarding } from "@/lib/onboarding/store";
import { ADMIN_2FA_CODE } from "@/lib/onboarding/registry";
import { toast } from "@/hooks/use-toast";

const DEMO_IDENTITIES = [
  { icon: <Car className="h-3.5 w-3.5" />, label: "Active driver", id: "+254722334455", note: "Kevin Otieno — live & verified" },
  { icon: <RefreshCcw className="h-3.5 w-3.5" />, label: "Awaiting verification", id: "+254733114477", note: "Faith Wambui — watch auto-checks run" },
  { icon: <UserCheck className="h-3.5 w-3.5" />, label: "Flagged applicant", id: "+254701998822", note: "John Mwangi — name mismatch" },
  { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: "Suspended driver", id: "+254799887766", note: "Samson Barasa — expired sticker" },
  { icon: <Landmark className="h-3.5 w-3.5" />, label: "Admin", id: "demitri@msafiri.co.ke", note: "2FA code: msafiri2026" },
];

export default function LoginScreen() {
  const [step, setStep] = useState<"id" | "otp" | "2fa">("id");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [code2fa, setCode2fa] = useState("");
  const [showDemo, setShowDemo] = useState(false);

  const login = useOnboarding((s) => s.login);
  const verifyAdmin2FA = useOnboarding((s) => s.verifyAdmin2FA);
  const resetAll = useOnboarding((s) => s.resetAll);

  const submitIdentity = () => {
    if (identifier.trim().length < 5) {
      toast({ title: "Enter your phone number or email" });
      return;
    }
    setStep("otp");
  };

  const submitOtp = () => {
    if (otp.trim().length < 4) {
      toast({ title: "Enter the 4-digit code", description: "Any 4 digits work in this prototype." });
      return;
    }
    const res = login(identifier);
    if (res.needs2FA) setStep("2fa");
  };

  const submit2FA = () => {
    const ok = verifyAdmin2FA(code2fa);
    if (!ok) {
      toast({ title: "Wrong access code", description: `Hint: ${ADMIN_2FA_CODE}` });
      return;
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8f7] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          {/* brand */}
          <div className="text-center mb-6">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Car className="h-7 w-7 text-white" />
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">Msafiri</h1>
            <p className="text-sm text-slate-500">Driver onboarding &amp; compliance portal</p>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-5">
              {step === "id" && (
                <>
                  <h2 className="font-semibold text-slate-900">Welcome</h2>
                  <p className="text-sm text-slate-500 mt-1">Email or phone — the platform recognises your role automatically.</p>
                  <Input
                    className="mt-4 h-11"
                    placeholder="e.g. +254722334455"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitIdentity()}
                    aria-label="Email or phone"
                  />
                  <Button className="w-full h-11 mt-3 bg-emerald-600 hover:bg-emerald-700" onClick={submitIdentity}>
                    Continue
                  </Button>
                  <p className="mt-3 text-xs text-slate-400">
                    New here? Any unrecognised number starts a driver application.
                  </p>
                </>
              )}

              {step === "otp" && (
                <>
                  <Button variant="ghost" size="sm" className="px-2 -ml-2 mb-1" onClick={() => setStep("id")}>
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-emerald-600" /> Verify {identifier}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Enter the 4-digit SMS code (any 4 digits in this prototype).</p>
                  <Input
                    className="mt-4 h-11 tracking-[0.4em] text-center"
                    placeholder="••••"
                    maxLength={4}
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && submitOtp()}
                    aria-label="4-digit code"
                  />
                  <Button className="w-full h-11 mt-3 bg-emerald-600 hover:bg-emerald-700" onClick={submitOtp}>
                    Verify &amp; continue
                  </Button>
                </>
              )}

              {step === "2fa" && (
                <>
                  <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-emerald-600" /> Admin two-factor
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Admin access detected for <b>{identifier}</b>. Enter your access code.
                  </p>
                  <Input
                    className="mt-4 h-11"
                    placeholder="Access code"
                    type="password"
                    value={code2fa}
                    onChange={(e) => setCode2fa(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit2FA()}
                    aria-label="Admin access code"
                  />
                  <Button className="w-full h-11 mt-3 bg-emerald-600 hover:bg-emerald-700" onClick={submit2FA}>
                    Unlock admin console
                  </Button>
                  <p className="mt-3 text-xs text-slate-400">Demo code: {ADMIN_2FA_CODE}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* demo identities */}
          <button
            className="mt-4 text-xs text-emerald-700 font-medium underline underline-offset-2"
            onClick={() => setShowDemo((v) => !v)}
          >
            {showDemo ? "Hide demo logins" : "Show demo logins"}
          </button>
          {showDemo && (
            <div className="mt-2 space-y-1.5">
              {DEMO_IDENTITIES.map((x) => (
                <button
                  key={x.id}
                  className="w-full flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors"
                  onClick={() => {
                    setIdentifier(x.id);
                    setStep("id");
                  }}
                >
                  <span className="text-emerald-700">{x.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-slate-800">{x.label}</span>
                    <span className="block text-[11px] text-slate-400 truncate">{x.note}</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">{x.id}</span>
                </button>
              ))}
              <button
                className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-left text-[11px] text-slate-500 hover:border-emerald-300"
                onClick={() => {
                  resetAll();
                  toast({ title: "Demo data reset" });
                }}
              >
                ⟲ Reset all demo data (seed drivers back to initial state)
              </button>
            </div>
          )}

          {/* trust indicators */}
          <div className="mt-6 space-y-1.5 text-[11px] text-slate-400 text-center">
            <p>No driver takes a single trip before passing the 7-Point KYD Gate.</p>
            <p>Every boarding is PIN-verified — no impostor pickups at Likoni or Diani stages.</p>
            <p>Documents are checked against NTSA · eCitizen IPRS · DCI · IRA registries.</p>
          </div>
        </div>
      </div>
      <footer className="py-4 text-center text-[11px] text-slate-400">
        Msafiri prototype · onboarding module · Mombasa, Kenya
      </footer>
    </div>
  );
}
