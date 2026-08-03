import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { PriorityBadge } from "@/components/Badges";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Sparkles, RefreshCw, Copy, Loader2, Save, Mail, Phone,
  Building2, Target, DollarSign, Radio, Check,
} from "lucide-react";

const STAGES = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [requalifying, setRequalifying] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(`/leads/${id}`);
      setLead(data);
      setForm(data);
    } catch {
      toast.error("Lead not found");
      navigate("/leads");
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/leads/${id}`, {
        name: form.name, email: form.email, phone: form.phone, company: form.company,
        source: form.source, interest: form.interest, budget: form.budget,
        notes: form.notes, stage: form.stage,
      });
      setLead(data);
      toast.success("Lead updated");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const updateStage = async (stage) => {
    setForm((f) => ({ ...f, stage }));
    try {
      const { data } = await api.put(`/leads/${id}`, { stage });
      setLead(data);
      toast.success(`Moved to ${stage}`);
    } catch {
      toast.error("Failed to update stage");
    }
  };

  const requalify = async () => {
    setRequalifying(true);
    try {
      const { data } = await api.post(`/leads/${id}/requalify`);
      setLead(data);
      setForm((f) => ({ ...f, ...data }));
      toast.success("Re-qualified by AI");
    } catch {
      toast.error("Re-qualify failed");
    } finally {
      setRequalifying(false);
    }
  };

  const copyMsg = () => {
    navigator.clipboard.writeText(lead.ai_follow_up || "");
    setCopied(true);
    toast.success("Follow-up copied");
    setTimeout(() => setCopied(false), 1500);
  };

  if (!lead || !form) return <div className="py-20 text-center text-[#71717A]"><Loader2 className="h-6 w-6 animate-spin inline" /></div>;

  return (
    <div className="space-y-6" data-testid="lead-detail-page">
      <button onClick={() => navigate("/leads")} className="flex items-center gap-2 text-sm text-[#71717A] hover:text-[#EDEDED] transition-colors" data-testid="back-btn">
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-[#16161A] border border-[#1F1F24] grid place-items-center font-head text-lg font-semibold text-[#BEF264]">
            {(lead.name || "L").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="font-head text-3xl font-semibold tracking-tight">{lead.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <PriorityBadge priority={lead.ai_priority} testid="detail-priority" />
              <span className="text-sm text-[#71717A]">{lead.company || "No company"}</span>
            </div>
          </div>
        </div>
        <div className="w-[180px]">
          <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-[#71717A] mb-1.5">Stage</label>
          <Select value={form.stage} onValueChange={updateStage}>
            <SelectTrigger data-testid="stage-select" className="bg-[#0E0E11] border-[#1F1F24] text-[#EDEDED] focus:ring-1 focus:ring-[#EDEDED]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0E0E11] border-[#1F1F24] text-[#EDEDED]">
              {STAGES.map((s) => <SelectItem key={s} value={s} className="focus:bg-[#16161A] focus:text-[#EDEDED]">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI insights */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0E0E11] border rounded-xl p-6" style={{ borderColor: "rgba(190,242,100,0.25)" }} data-testid="ai-panel">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#BEF264]" />
                <h2 className="font-head text-lg font-medium tracking-tight">AI Qualification</h2>
              </div>
              <button
                data-testid="requalify-btn"
                onClick={requalify}
                disabled={requalifying}
                className="flex items-center gap-1.5 text-xs font-medium text-[#BEF264] border border-[#BEF264]/30 px-3 py-1.5 rounded-md hover:bg-[#BEF264]/10 transition-colors disabled:opacity-60"
              >
                {requalifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Re-run
              </button>
            </div>

            <div className="flex items-center gap-6 mb-6">
              <div className="relative h-24 w-24 shrink-0">
                <svg className="h-24 w-24 -rotate-90">
                  <circle cx="48" cy="48" r="40" stroke="#1F1F24" strokeWidth="8" fill="none" />
                  <circle cx="48" cy="48" r="40" stroke="#BEF264" strokeWidth="8" fill="none"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - lead.ai_score / 100)}`}
                    strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 grid place-items-center">
                  <span className="font-head text-2xl font-semibold text-[#BEF264]" data-testid="ai-score">{lead.ai_score}</span>
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#71717A]">Reasoning</span>
                <p className="text-sm text-[#A1A1AA] leading-relaxed mt-1" data-testid="ai-reasoning">{lead.ai_reasoning}</p>
              </div>
            </div>

            <div className="bg-[#050505] border border-[#1F1F24] rounded-lg p-4 mb-4">
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#71717A]">Recommended next action</span>
              <p className="text-sm text-[#EDEDED] mt-1.5" data-testid="ai-next-action">{lead.ai_next_action}</p>
            </div>

            <div className="bg-[#050505] border border-[#1F1F24] rounded-lg p-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#71717A]">Personalised follow-up</span>
                <button data-testid="copy-followup-btn" onClick={copyMsg} className="flex items-center gap-1.5 text-xs text-[#BEF264] hover:underline">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-sm text-[#A1A1AA] leading-relaxed whitespace-pre-line" data-testid="ai-followup">{lead.ai_follow_up}</p>
            </div>
          </div>
        </div>

        {/* Editable details */}
        <div className="bg-[#0E0E11] border border-[#1F1F24] rounded-xl p-6 space-y-4 h-fit">
          <h2 className="font-head text-lg font-medium tracking-tight">Lead details</h2>
          <EditField icon={Mail} label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} testid="edit-email" />
          <EditField icon={Phone} label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} testid="edit-phone" />
          <EditField icon={Building2} label="Company" value={form.company} onChange={(v) => setForm({ ...form, company: v })} testid="edit-company" />
          <EditField icon={Radio} label="Source" value={form.source} onChange={(v) => setForm({ ...form, source: v })} testid="edit-source" />
          <EditField icon={Target} label="Interested in" value={form.interest} onChange={(v) => setForm({ ...form, interest: v })} testid="edit-interest" />
          <EditField icon={DollarSign} label="Budget" value={form.budget} onChange={(v) => setForm({ ...form, budget: v })} testid="edit-budget" />
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-[#71717A] mb-1.5">Notes</label>
            <textarea
              data-testid="edit-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full bg-[#050505] border border-[#1F1F24] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#EDEDED] transition-colors resize-none"
            />
          </div>
          <button
            data-testid="save-lead-btn"
            onClick={save}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-[#FAFAFA] text-[#050505] font-semibold text-sm py-2.5 rounded-md hover:bg-[#BEF264] transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function EditField({ icon: Icon, label, value, onChange, testid }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#71717A] mb-1.5">
        <Icon className="h-3.5 w-3.5" /> {label}
      </label>
      <input
        data-testid={testid}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#050505] border border-[#1F1F24] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#EDEDED] transition-colors"
      />
    </div>
  );
}
