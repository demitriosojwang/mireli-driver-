"use client";
// ─── Admin compliance console ───────────────────────────────────────────────
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DOC_BY_KIND } from "@/lib/onboarding/registry";
import { useOnboarding } from "@/lib/onboarding/store";
import AdminDetail from "./AdminDetail";
import AdminSafety from "./AdminSafety";
import { StatusBadge, DocBadge, ExpiryChip, fmtDate, fmtTime } from "./shared";
import { toast } from "@/hooks/use-toast";
import {
  Car, LogOut, Users, Hourglass, AlertTriangle, ShieldOff, CalendarClock, BellRing, ScrollText, ChevronLeft,
  FastForward, RotateCcw, ClipboardCheck, TrendingUp,
} from "lucide-react";

const PIPELINE = ["draft", "submitted", "verifying", "action_required", "verified", "induction", "contract"];

export default function AdminApp() {
  const session = useOnboarding((s) => s.session);
  const drivers = useOnboarding((s) => s.drivers);
  const notifications = useOnboarding((s) => s.notifications);
  const audit = useOnboarding((s) => s.audit);
  const logout = useOnboarding((s) => s.logout);
  const advanceClock = useOnboarding((s) => s.advanceClock);
  const resetClock = useOnboarding((s) => s.resetClock);
  const demoDayOffset = useOnboarding((s) => s.demoDayOffset);
  const [tab, setTab] = useState("overview");
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const stats = useMemo(() => {
    const active = drivers.filter((d) => d.status === "active").length;
    const pipeline = drivers.filter((d) => PIPELINE.includes(d.status)).length;
    const flagged = drivers.filter((d) => d.documents.some((x) => x.status === "flagged")).length;
    const suspended = drivers.filter((d) => d.status === "suspended").length;
    const expiringSoon = drivers.filter((d) => ["active", "verified", "induction", "contract"].includes(d.status)).filter((d) =>
      d.documents.some((x) => x.status === "verified" && x.expiresAt && (new Date(x.expiresAt).getTime() - Date.now()) / 86400000 <= 30),
    ).length;
    return { active, pipeline, flagged, suspended, expiringSoon };
  }, [drivers]);

  const flaggedQueue = drivers.filter((d) => d.documents.some((x) => x.status === "flagged") && !["rejected", "deactivated"].includes(d.status));
  const adminFeed = notifications.filter((n) => !n.driverId);

  const radar = drivers
    .flatMap((d) =>
      d.documents
        .filter((x) => x.expiresAt && x.status !== "missing" && !["rejected", "deactivated"].includes(d.status))
        .map((x) => ({
          driverId: d.id,
          driverName: d.profile.fullName,
          plate: d.vehicle?.plate ?? "—",
          kind: x.kind,
          expiresAt: x.expiresAt!,
          status: x.status,
          daysLeft: Math.ceil((new Date(x.expiresAt!).getTime() - (Date.now() + demoDayOffset * 86400000)) / 86400000),
        })),
    )
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const demoDate = new Date(Date.now() + demoDayOffset * 86400000);
  const visibleDrivers = drivers.filter((d) => (filter === "all" ? true : filter === "pipeline" ? PIPELINE.includes(d.status) : d.status === filter));

  return (
    <div className="min-h-screen bg-[#f7f8f7] flex flex-col">
      {/* header */}
      <header className="bg-slate-900 text-white sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
            <Car className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Msafiri Compliance Console</p>
            <p className="text-[11px] text-slate-400 leading-tight">{session?.name} · full audit trail enabled</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-mono">{demoDate.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</span>
            {demoDayOffset !== 0 && <span className="text-[10px] text-amber-400">+{demoDayOffset}d</span>}
          </div>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800" onClick={logout} aria-label="Log out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 space-y-4">
        {selected ? (
          <>
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setSelected(null)}>
              <ChevronLeft className="h-4 w-4" /> All applications
            </Button>
            <AdminDetail driverId={selected} />
          </>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-6 h-10 max-w-3xl">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="apps" className="text-xs">Applications</TabsTrigger>
              <TabsTrigger value="flagged" className="text-xs">
                Flagged <span className="ml-1 hidden sm:inline">({flaggedQueue.length})</span>
              </TabsTrigger>
              <TabsTrigger value="radar" className="text-xs">Expiry radar</TabsTrigger>
              <TabsTrigger value="audit" className="text-xs">Audit</TabsTrigger>
              <TabsTrigger value="safety" className="text-xs">Safety</TabsTrigger>
            </TabsList>

            {/* ── OVERVIEW ── */}
            <TabsContent value="overview" className="space-y-4 mt-3">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { icon: <Users className="h-4 w-4" />, label: "Active drivers", value: stats.active, cls: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                  { icon: <Hourglass className="h-4 w-4" />, label: "In pipeline", value: stats.pipeline, cls: "text-amber-600 bg-amber-50 border-amber-100" },
                  { icon: <AlertTriangle className="h-4 w-4" />, label: "Flagged", value: stats.flagged, cls: "text-yellow-600 bg-yellow-50 border-yellow-100" },
                  { icon: <ShieldOff className="h-4 w-4" />, label: "Suspended", value: stats.suspended, cls: "text-red-600 bg-red-50 border-red-100" },
                  { icon: <TrendingUp className="h-4 w-4" />, label: "Expiring ≤30d", value: stats.expiringSoon, cls: "text-orange-600 bg-orange-50 border-orange-100" },
                ].map((s) => (
                  <Card key={s.label} className={`border ${s.cls}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 opacity-80">{s.icon}<span className="text-[11px] font-medium">{s.label}</span></div>
                      <p className="text-2xl font-bold mt-1">{s.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* demo clock */}
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[220px]">
                      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        <FastForward className="h-4 w-4 text-amber-600" /> Demo clock — simulate time passing
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Advance the clock past a document&apos;s expiry (e.g. Peter&apos;s Good Conduct in ~9 days) to watch
                        reminders fire and auto-suspension kick in.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[1, 7, 30].map((d) => (
                        <Button key={d} size="sm" variant="outline" className="h-8 text-xs bg-white" onClick={() => { advanceClock(d); toast({ title: `Clock advanced +${d} day(s)`, description: "Compliance sweep re-run." }); }}>
                          +{d}d
                        </Button>
                      ))}
                      <Button size="sm" variant="outline" className="h-8 text-xs bg-white" onClick={() => { resetClock(); toast({ title: "Clock reset" }); }}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* admin feed */}
              <Card className="border-slate-200">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <BellRing className="h-4 w-4 text-emerald-600" /> Operations feed
                  </h3>
                  <div className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1">
                    {adminFeed.length === 0 && <p className="text-xs text-slate-400">Quiet for now.</p>}
                    {adminFeed.slice(0, 15).map((n) => (
                      <div key={n.id} className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                        <p className="text-xs font-medium text-slate-800">{n.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{n.body}</p>
                        <p className="text-[10px] text-slate-300 mt-0.5">{fmtDate(n.at)} {fmtTime(n.at)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── APPLICATIONS ── */}
            <TabsContent value="apps" className="mt-3">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {["all", "pipeline", "active", "suspended", "rejected"].map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={`text-xs rounded-full border px-3 py-1 transition-colors ${filter === f ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
                    {f === "all" ? "All" : f === "pipeline" ? "In pipeline" : f[0].toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {visibleDrivers.map((d) => (
                  <button key={d.id} onClick={() => setSelected(d.id)} className="text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-emerald-400 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">{d.profile.fullName}</p>
                        <p className="text-[11px] text-slate-400 truncate">{d.vehicle ? `${d.vehicle.plate} · ${d.vehicle.seats} seats` : "No vehicle yet"}</p>
                      </div>
                      <StatusBadge status={d.status} />
                    </div>
                    <div className="mt-3 flex items-center gap-1.5">
                      {d.documents.map((x) => (
                        <span key={x.kind} title={DOC_BY_KIND[x.kind].short} className={`h-1.5 flex-1 rounded-full ${x.status === "verified" ? "bg-emerald-500" : x.status === "flagged" ? "bg-yellow-400" : x.status === "failed" || x.status === "expired" ? "bg-red-400" : x.status === "missing" ? "bg-slate-200" : "bg-amber-300"}`} />
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400">{d.documents.filter((x) => x.status === "verified").length}/7 verified · applied {fmtDate(d.submittedAt ?? d.createdAt)}</p>
                  </button>
                ))}
              </div>
            </TabsContent>

            {/* ── FLAGGED QUEUE ── */}
            <TabsContent value="flagged" className="mt-3 space-y-3">
              {flaggedQueue.length === 0 && (
                <Card><CardContent className="p-6 text-center text-sm text-slate-400">No flagged applications — the automated checks are fully in agreement.</CardContent></Card>
              )}
              {flaggedQueue.map((d) => (
                <Card key={d.id} className="border-yellow-200 bg-yellow-50/40">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <button className="font-semibold text-slate-900 text-sm hover:underline text-left" onClick={() => setSelected(d.id)}>
                        {d.profile.fullName}
                      </button>
                      <StatusBadge status={d.status} />
                      <span className="text-[11px] text-slate-400">{d.vehicle?.plate}</span>
                      <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={() => setSelected(d.id)}>
                        <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Review
                      </Button>
                    </div>
                    <div className="mt-2 space-y-1">
                      {d.documents.filter((x) => x.status === "flagged").map((x) => (
                        <p key={x.kind} className="text-[11px] bg-white border border-yellow-200 rounded px-2 py-1 text-yellow-800">
                          <b>{DOC_BY_KIND[x.kind].short}:</b> {x.flagReason}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* ── EXPIRY RADAR ── */}
            <TabsContent value="radar" className="mt-3">
              <Card className="border-slate-200">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Documents by remaining validity</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Amber = renew within 30 days. Red = expired, driver auto-suspended.</p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs min-w-[640px]">
                      <thead>
                        <tr className="text-left text-slate-400 border-b border-slate-200">
                          <th className="py-2 pr-2 font-medium">Driver</th>
                          <th className="py-2 pr-2 font-medium">Document</th>
                          <th className="py-2 pr-2 font-medium">Expires</th>
                          <th className="py-2 pr-2 font-medium">Window</th>
                          <th className="py-2 pr-2 font-medium">Status</th>
                          <th className="py-2 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {radar.map((r) => (
                          <tr key={`${r.driverId}:${r.kind}`} className={`border-b border-slate-100 ${r.daysLeft < 0 ? "bg-red-50/50" : r.daysLeft <= 30 ? "bg-amber-50/50" : ""}`}>
                            <td className="py-2 pr-2">
                              <button className="font-medium text-slate-800 hover:underline text-left" onClick={() => setSelected(r.driverId)}>{r.driverName}</button>
                              <span className="block text-[10px] text-slate-400 font-mono">{r.plate}</span>
                            </td>
                            <td className="py-2 pr-2 text-slate-600">{DOC_BY_KIND[r.kind].short}</td>
                            <td className="py-2 pr-2 text-slate-500">{fmtDate(r.expiresAt)}</td>
                            <td className="py-2 pr-2"><ExpiryChip expiresAt={r.expiresAt} /></td>
                            <td className="py-2 pr-2"><DocBadge status={r.status} /></td>
                            <td className="py-2">
                              {r.daysLeft <= 14 && r.status === "verified" && (
                                <span className="text-[10px] text-amber-600 flex items-center gap-1"><CalendarClock className="h-3 w-3" /> reminder due</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── AUDIT ── */}
            <TabsContent value="audit" className="mt-3">
              <Card className="border-slate-200">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-emerald-600" /> Audit trail
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Append-only record of every automated and human action.</p>
                  <div className="mt-3 overflow-x-auto max-h-[420px] overflow-y-auto">
                    <table className="w-full text-xs min-w-[640px]">
                      <thead className="sticky top-0 bg-white">
                        <tr className="text-left text-slate-400 border-b border-slate-200">
                          <th className="py-2 pr-2 font-medium">When</th>
                          <th className="py-2 pr-2 font-medium">Actor</th>
                          <th className="py-2 pr-2 font-medium">Action</th>
                          <th className="py-2 pr-2 font-medium">Entity</th>
                          <th className="py-2 font-medium">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audit.slice(0, 60).map((a) => (
                          <tr key={a.id} className="border-b border-slate-100">
                            <td className="py-2 pr-2 text-slate-400 whitespace-nowrap">{fmtDate(a.at)} {fmtTime(a.at)}</td>
                            <td className="py-2 pr-2">
                              <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${a.actorRole === "system" ? "bg-slate-100 text-slate-500" : a.actorRole === "admin" ? "bg-slate-900 text-white" : "bg-emerald-100 text-emerald-700"}`}>{a.actorRole}</span>
                              <span className="block text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]">{a.actor}</span>
                            </td>
                            <td className="py-2 pr-2 font-mono text-[11px] text-slate-700">{a.action}</td>
                            <td className="py-2 pr-2 font-mono text-[10px] text-slate-400">{a.entity}</td>
                            <td className="py-2 text-slate-500">{a.detail ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── SAFETY & LIVE OPS ── */}
            <TabsContent value="safety" className="mt-3">
              <AdminSafety />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <footer className="py-4 text-center text-[11px] text-slate-400">
        Msafiri Compliance Console · every action audited · Mombasa, Kenya
      </footer>
    </div>
  );
}
