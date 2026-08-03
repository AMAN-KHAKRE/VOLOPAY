import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";

export default function AuthPage() {
  const { login, user, ready } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "sales@demo.com", password: "demo1234" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (ready && user) navigate("/");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const url = mode === "login" ? "/auth/login" : "/auth/register";
      const payload = mode === "login"
        ? { email: form.email, password: form.password }
        : form;
      const { data } = await api.post(url, payload);
      login(data.token, data.user);
      toast.success(mode === "login" ? "Welcome back" : "Account created");
      navigate("/");
    } catch (err) {
      const msg = formatApiError(err.response?.data?.detail) || err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] relative flex items-center justify-center px-5">
      <div
        className="absolute inset-0 opacity-40 bg-cover bg-center"
        style={{ backgroundImage: "url(https://images.pexels.com/photos/12627677/pexels-photo-12627677.jpeg)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-[#050505]/40" />

      <div className="relative w-full max-w-md fade-up">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="h-9 w-9 rounded-md bg-[#BEF264] grid place-items-center">
            <Sparkles className="h-5 w-5 text-[#050505]" strokeWidth={2.5} />
          </div>
          <span className="font-head text-xl font-semibold tracking-tight">Pipeline</span>
        </div>

        <div className="bg-[#0E0E11] border border-[#1F1F24] rounded-xl p-7">
          <h1 className="font-head text-2xl font-semibold tracking-tight mb-1">
            {mode === "login" ? "Sign in to your workspace" : "Create your workspace"}
          </h1>
          <p className="text-sm text-[#71717A] mb-6">AI-powered lead qualification for sales teams.</p>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <Field label="Full name" testid="name-input" value={form.name}
                onChange={(v) => setForm({ ...form, name: v })} placeholder="Jane Doe" required />
            )}
            <Field label="Email" type="email" testid="email-input" value={form.email}
              onChange={(v) => setForm({ ...form, email: v })} placeholder="you@company.com" required />
            <Field label="Password" type="password" testid="password-input" value={form.password}
              onChange={(v) => setForm({ ...form, password: v })} placeholder="••••••••" required />

            {error && <p data-testid="auth-error" className="text-sm text-[#F87171]">{error}</p>}

            <button
              data-testid="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#FAFAFA] text-[#050505] font-semibold py-2.5 rounded-md hover:bg-[#BEF264] transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{mode === "login" ? "Sign in" : "Create account"}<ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <p className="text-sm text-[#71717A] mt-5 text-center">
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <button
              data-testid="toggle-mode-btn"
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="text-[#BEF264] hover:underline font-medium"
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
        <p className="text-center text-xs text-[#71717A] mt-4">Demo login prefilled · sales@demo.com / demo1234</p>
      </div>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, placeholder, testid, required }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-[#71717A] mb-1.5">{label}</label>
      <input
        data-testid={testid}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#050505] border border-[#1F1F24] rounded-md px-3 py-2.5 text-sm text-[#EDEDED] placeholder:text-[#52525B] focus:outline-none focus:ring-1 focus:ring-[#EDEDED] transition-colors"
      />
    </div>
  );
}
