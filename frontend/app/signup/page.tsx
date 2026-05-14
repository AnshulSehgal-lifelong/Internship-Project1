"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/auth-context";
import { UserPlus, Mail, Lock, User, Briefcase, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
  const { signup } = useAuth();
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "Employee",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await signup(formData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-[#050505] flex flex-col items-center justify-center px-3 py-4">
      {/* Decorative background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-primary/20 border border-primary/30 rounded-xl flex items-center justify-center mx-auto mb-2">
            <UserPlus className="text-primary" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Join TalentFlow</h1>
          <p className="text-gray-400 text-sm">Sign up to get started</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-3 p-2 bg-red-900/20 border border-red-500/30 rounded-lg flex items-start gap-2">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-2.5">
          {/* First Name */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">First Name</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-2.5 text-gray-500" />
              <input
                name="first_name"
                required
                value={formData.first_name}
                onChange={handleChange}
                placeholder="John"
                className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm text-white placeholder:text-gray-600"
              />
            </div>
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Last Name</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-2.5 text-gray-500" />
              <input
                name="last_name"
                required
                value={formData.last_name}
                onChange={handleChange}
                placeholder="Doe"
                className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm text-white placeholder:text-gray-600"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-2.5 text-gray-500" />
              <input
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="john@company.com"
                className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm text-white placeholder:text-gray-600"
              />
            </div>
          </div>

          {/* Role Dropdown */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Role</label>
            <div className="relative">
              <Briefcase size={14} className="absolute left-3 top-2.5 text-gray-500 pointer-events-none" />
              <select
                name="role"
                required
                value={formData.role}
                onChange={handleChange}
                className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm text-white appearance-none cursor-pointer"
              >
                <option value="Employee" className="bg-slate-900 text-white">Employee</option>
                <option value="HR" className="bg-slate-900 text-white">HR Manager</option>
                <option value="Administrator" className="bg-slate-900 text-white">Administrator</option>
              </select>
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-2.5 text-gray-500" />
              <input
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm text-white placeholder:text-gray-600"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 mt-3"
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creating...
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-gray-400 text-xs mt-3">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:text-primary/80 font-medium transition">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
