"use client";
// ─── Msafiri Driver Onboarding — app shell ──────────────────────────────────
import { useSyncExternalStore } from "react";
import { useOnboarding } from "@/lib/onboarding/store";
import LoginScreen from "@/components/onboarding/LoginScreen";
import DriverApp from "@/components/onboarding/DriverApp";
import AdminApp from "@/components/onboarding/AdminApp";
import { Car } from "lucide-react";

const emptySubscribe = () => () => {};

export default function Home() {
  const session = useOnboarding((s) => s.session);
  // hydration-safe mounted flag (server snapshot = false, client = true)
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <div className="min-h-screen bg-emerald-600 flex flex-col items-center justify-center">
        <div className="h-16 w-16 rounded-2xl bg-white/15 flex items-center justify-center animate-pulse">
          <Car className="h-8 w-8 text-white" />
        </div>
        <p className="mt-4 text-white font-semibold tracking-wide">Msafiri</p>
        <p className="text-emerald-100 text-xs mt-1">Driver onboarding · Mombasa</p>
      </div>
    );
  }

  if (!session) return <LoginScreen />;
  if (session.role === "admin") return <AdminApp />;
  return <DriverApp />;
}
