import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/Dashboard";
import Leads from "@/pages/Leads";
import LeadDetail from "@/pages/LeadDetail";
import Layout from "@/components/Layout";

function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="min-h-screen bg-[#050505]" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/leads" element={<Protected><Leads /></Protected>} />
          <Route path="/leads/:id" element={<Protected><LeadDetail /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" theme="dark" />
    </AuthProvider>
  );
}

export default App;
