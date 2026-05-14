"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/auth-context";
import { LogIn, Mail, Lock, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);
      await login(formData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-[#050505] flex flex-col items-center justify-center px-3 py-4">
      {/* Decorative background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 bg-primary/20 border border-primary/30 rounded-xl flex items-center justify-center mx-auto mb-3">
            <LogIn className="text-primary" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Welcome Back</h1>
          <p className="text-gray-400 text-sm">Sign in to your account</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-start gap-2">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Email Field */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-2.5 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm text-white placeholder:text-gray-600"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-medium text-gray-300">Password</label>
              <button type="button" className="text-xs text-primary hover:text-primary/80 transition">
                Forgot?
              </button>
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-2.5 text-gray-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm text-white placeholder:text-gray-600"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 mt-4"
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-gray-400 text-xs mt-4">
          Don't have an account?{" "}
          <Link href="/signup" className="text-primary hover:text-primary/80 font-medium transition">
            Create one
          </Link>
        </p>

        {/* Demo Credentials */}
        <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Demo:</p>
          <p className="text-xs text-gray-400">📧 admin@talentflow.local</p>
          <p className="text-xs text-gray-400">🔐 Admin@1234</p>
        </div>
      </div>
    </div>
  );
}
