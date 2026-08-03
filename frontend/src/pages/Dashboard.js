import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { PriorityBadge } from "@/components/Badges";
import { Users, Flame, Trophy, Gauge, TrendingUp, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";

const STAGE_COLORS = {
  New: "#71717A", Contacted: "#3B82F6", Qualified: "#BEF264",
  Proposal: "#A855F7", Won: "#10B981", Lost: "#3F3F46",
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/leads/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/leads").then((r) => setRecent(r.data.slice(0, 6))).catch(() => {});
  }, []);

  const cards = stats
    ? [
        { label: "Total Leads", value: stats.total, icon: Users, accent: "#EDEDED", testid: "stat-total" },
        { label: "Hot Leads", value: stats.by_priority.Hot, icon: Flame, accent: "#EF4444", testid: "stat-hot" },
        { label: "Avg AI Score", value: stats.avg_score, icon: Gauge, accent: "#BEF264", testid: "stat-avg" },
        { label: "Won", value: stats.won, icon: Trophy, accent: "#10B981", testid: "stat-won" },
      ]
    : [];

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-head text-3xl md:text-4xl font-semibold tracking-tight">Pipeline overview</h1>
          <p className="text-sm text-[#71717A] mt-1">AI-qualified leads, prioritised for your team.</p>
        </div>
        <button
          data-testid="dashboard-view-leads"
          onClick={() => navigate("/leads")}
          className="flex items-center gap-2 bg-[#FAFAFA] text-[#050505] font-semibold text-sm px-4 py-2.5 rounded-md hover:bg-[#BEF264] transition-colors"
        >
          View all leads <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 border border-[#1F1F24] rounded-xl overflow-hidden bg-[#0E0E11]">
        {cards.map((c, i) => (
          <div
            key={c.label}
            data-testid={c.testid}
            className={`p-6 ${i % 2 === 0 ? "border-r" : ""} lg:border-r border-[#1F1F24] ${i < 2 ? "border-b lg:border-b-0" : ""}`}
          >
            <div className="flex items-center gap-2 mb-3">
              <c.icon className="h-4 w-4" style={{ color: c.accent }} />
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#71717A]">{c.label}</span>
            </div>
            <span className="font-head text-3xl font-semibold tracking-tight" style={{ color: c.accent }}>
              {c.value}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-[#0E0E11] border border-[#1F1F24] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-4 w-4 text-[#BEF264]" />
            <h2 className="font-head text-lg font-medium tracking-tight">Leads by stage</h2>
          </div>
          {stats && (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.by_stage} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="stage" tick={{ fill: "#71717A", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "#16161A" }}
                  contentStyle={{ background: "#0E0E11", border: "1px solid #1F1F24", borderRadius: 8, color: "#EDEDED" }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {stats.by_stage.map((s) => (
                    <Cell key={s.stage} fill={STAGE_COLORS[s.stage]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="lg:col-span-2 bg-[#0E0E11] border border-[#1F1F24] rounded-xl p-6">
          <h2 className="font-head text-lg font-medium tracking-tight mb-4">Recent leads</h2>
          <div className="space-y-1">
            {recent.length === 0 && <p className="text-sm text-[#71717A]">No leads yet.</p>}
            {recent.map((l) => (
              <button
                key={l.id}
                onClick={() => navigate(`/leads/${l.id}`)}
                className="w-full flex items-center justify-between py-2.5 px-2 rounded-md hover:bg-[#16161A] transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{l.name}</p>
                  <p className="text-xs text-[#71717A] truncate">{l.company || l.email || "—"}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-head text-sm font-semibold text-[#BEF264]">{l.ai_score}</span>
                  <PriorityBadge priority={l.ai_priority} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
