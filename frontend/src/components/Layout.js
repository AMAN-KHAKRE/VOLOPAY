import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Users, LogOut, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/leads", label: "Leads", icon: Users, testid: "nav-leads" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = (user?.name || "U").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#050505] text-[#EDEDED]">
      <header className="sticky top-0 z-40 bg-[#050505]/70 backdrop-blur-xl border-b border-[#1F1F24]">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-[#BEF264] grid place-items-center">
                <Sparkles className="h-4 w-4 text-[#050505]" strokeWidth={2.5} />
              </div>
              <span className="font-head text-lg font-semibold tracking-tight">Pipeline</span>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/"}
                  data-testid={n.testid}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#16161A] text-[#EDEDED]"
                        : "text-[#71717A] hover:text-[#EDEDED] hover:bg-[#16161A]"
                    }`
                  }
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-medium">{user?.name}</span>
              <span className="text-xs text-[#71717A]">{user?.email}</span>
            </div>
            <Avatar className="h-9 w-9 border border-[#1F1F24]">
              <AvatarFallback className="bg-[#16161A] text-[#BEF264] text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              data-testid="logout-btn"
              onClick={() => { logout(); navigate("/login"); }}
              className="p-2 rounded-md text-[#71717A] hover:text-[#EF4444] hover:bg-[#16161A] transition-colors"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <nav className="md:hidden flex items-center gap-1 px-5 pb-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${
                  isActive ? "bg-[#16161A] text-[#EDEDED]" : "text-[#71717A]"
                }`
              }
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-5 md:px-8 py-8">{children}</main>
    </div>
  );
}
