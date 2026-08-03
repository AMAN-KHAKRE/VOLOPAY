import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { PriorityBadge, StageBadge } from "@/components/Badges";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Upload, Trash2, Loader2, Sparkles, X } from "lucide-react";

const STAGES = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];
const EMPTY = { name: "", email: "", phone: "", company: "", source: "", interest: "", budget: "", notes: "", stage: "New" };

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [priority, setPriority] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (stage !== "all") params.stage = stage;
      if (priority !== "all") params.priority = priority;
      const { data } = await api.get("/leads", { params });
      setLeads(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [search, stage, priority]);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      await api.post("/leads", form);
      toast.success("Lead added & qualified by AI");
      setDialogOpen(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Failed to add lead");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/leads/${deleteId}`);
      toast.success("Lead deleted");
      setLeads((prev) => prev.filter((l) => l.id !== deleteId));
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleteId(null);
    }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/leads/import", fd);
      toast.success(`Imported & qualified ${data.imported} leads`);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6" data-testid="leads-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-head text-3xl md:text-4xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-[#71717A] mt-1">{leads.length} lead{leads.length !== 1 && "s"} in your workspace.</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv" onChange={onImport} className="hidden" data-testid="csv-file-input" />
          <button
            data-testid="import-csv-btn"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 border border-[#1F1F24] text-[#EDEDED] text-sm font-medium px-4 py-2.5 rounded-md hover:bg-[#16161A] transition-colors disabled:opacity-60"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import CSV
          </button>
          <button
            data-testid="add-lead-btn"
            onClick={() => { setForm(EMPTY); setDialogOpen(true); }}
            className="flex items-center gap-2 bg-[#FAFAFA] text-[#050505] font-semibold text-sm px-4 py-2.5 rounded-md hover:bg-[#BEF264] transition-colors"
          >
            <Plus className="h-4 w-4" /> Add lead
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71717A]" />
          <input
            data-testid="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, company…"
            className="w-full bg-[#0E0E11] border border-[#1F1F24] rounded-md pl-9 pr-3 py-2.5 text-sm text-[#EDEDED] placeholder:text-[#52525B] focus:outline-none focus:ring-1 focus:ring-[#EDEDED] transition-colors"
          />
        </div>
        <FilterSelect value={stage} onChange={setStage} testid="filter-stage" placeholder="All stages"
          options={[["all", "All stages"], ...STAGES.map((s) => [s, s])]} />
        <FilterSelect value={priority} onChange={setPriority} testid="filter-priority" placeholder="All priorities"
          options={[["all", "All priorities"], ["Hot", "Hot"], ["Warm", "Warm"], ["Cold", "Cold"]]} />
      </div>

      <div className="bg-[#0E0E11] border border-[#1F1F24] rounded-xl overflow-hidden">
        <div className="overflow-x-auto crm-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1F1F24] text-left">
                {["Lead", "Company", "Interest", "AI Score", "Priority", "Stage", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#71717A] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody data-testid="leads-table-body">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-[#71717A]"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-[#71717A]">No leads found. Add one to get AI qualification.</td></tr>
              ) : (
                leads.map((l) => (
                  <tr
                    key={l.id}
                    data-testid={`lead-row-${l.id}`}
                    onClick={() => navigate(`/leads/${l.id}`)}
                    className="border-b border-[#1F1F24] last:border-0 hover:bg-[#16161A] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#EDEDED]">{l.name}</p>
                      <p className="text-xs text-[#71717A]">{l.email || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-[#A1A1AA]">{l.company || "—"}</td>
                    <td className="px-4 py-3 text-[#A1A1AA] max-w-[200px] truncate">{l.interest || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="font-head text-base font-semibold text-[#BEF264]">{l.ai_score}</span>
                    </td>
                    <td className="px-4 py-3"><PriorityBadge priority={l.ai_priority} testid={`priority-${l.id}`} /></td>
                    <td className="px-4 py-3"><StageBadge stage={l.stage} /></td>
                    <td className="px-4 py-3 text-right">
                      <button
                        data-testid={`delete-lead-${l.id}`}
                        onClick={(e) => { e.stopPropagation(); setDeleteId(l.id); }}
                        className="p-1.5 rounded-md text-[#71717A] hover:text-[#EF4444] hover:bg-[#050505] transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add lead dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#0E0E11] border-[#1F1F24] text-[#EDEDED] max-w-lg" data-testid="add-lead-dialog">
          <DialogHeader>
            <DialogTitle className="font-head tracking-tight flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#BEF264]" /> New lead
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto crm-scroll pr-1">
            <Input label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testid="form-name" />
            <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} testid="form-email" />
            <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} testid="form-phone" />
            <Input label="Company" value={form.company} onChange={(v) => setForm({ ...form, company: v })} testid="form-company" />
            <Input label="Source" value={form.source} onChange={(v) => setForm({ ...form, source: v })} testid="form-source" placeholder="Website, referral…" />
            <Input label="Budget" value={form.budget} onChange={(v) => setForm({ ...form, budget: v })} testid="form-budget" placeholder="$5k/mo" />
            <div className="col-span-2">
              <Input label="Interested in" value={form.interest} onChange={(v) => setForm({ ...form, interest: v })} testid="form-interest" placeholder="Which product/service?" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-[#71717A] mb-1.5">Notes</label>
              <textarea
                data-testid="form-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Context, conversation summary, needs…"
                className="w-full bg-[#050505] border border-[#1F1F24] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#EDEDED] transition-colors resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded-md text-sm text-[#A1A1AA] hover:bg-[#16161A] transition-colors">Cancel</button>
            <button
              data-testid="submit-lead-btn"
              onClick={submit}
              disabled={saving}
              className="flex items-center gap-2 bg-[#FAFAFA] text-[#050505] font-semibold text-sm px-4 py-2 rounded-md hover:bg-[#BEF264] transition-colors disabled:opacity-60"
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Qualifying…</> : <><Sparkles className="h-4 w-4" /> Add & qualify</>}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-[#0E0E11] border-[#1F1F24] text-[#EDEDED]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-head tracking-tight">Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#71717A]">This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[#1F1F24] text-[#A1A1AA] hover:bg-[#16161A] hover:text-[#EDEDED]">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-delete-btn" onClick={confirmDelete} className="bg-[#EF4444] text-white hover:bg-[#dc2626]">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterSelect({ value, onChange, options, placeholder, testid }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger data-testid={testid} className="w-[160px] bg-[#0E0E11] border-[#1F1F24] text-[#EDEDED] focus:ring-1 focus:ring-[#EDEDED]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-[#0E0E11] border-[#1F1F24] text-[#EDEDED]">
        {options.map(([v, label]) => (
          <SelectItem key={v} value={v} className="focus:bg-[#16161A] focus:text-[#EDEDED]">{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Input({ label, value, onChange, testid, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-[#71717A] mb-1.5">{label}</label>
      <input
        data-testid={testid}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#050505] border border-[#1F1F24] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#EDEDED] transition-colors"
      />
    </div>
  );
}
