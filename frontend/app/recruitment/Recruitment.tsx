"use client";

import React from "react";
import {
  FileText,
  User,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth-context";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobOpeningRecord {
  id: number;
  title: string;
  description: string;
  requirements: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OpeningRow({
  opening,
  isSelected,
  onSelect,
}: {
  opening: JobOpeningRecord;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-4 border-b border-border/50 px-5 py-4 text-left transition-all last:border-0",
        isSelected
          ? "border-l-2 border-l-primary bg-primary/5"
          : "hover:bg-secondary/30"
      )}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-bold">
        {opening.title[0]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">{opening.title}</p>
          <span className="shrink-0 text-[10px] text-muted-foreground">#{opening.id}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {opening.requirements?.slice(0, 80)}
        </p>
      </div>
      <ChevronRight size={14} className="shrink-0 text-muted-foreground/40" />
    </button>
  );
}

function DetailPanel({
  opening,
  canEdit,
  onDelete,
  onOpenDirectory,
  onViewApplications,
}: {
  opening: JobOpeningRecord;
  canEdit: boolean;
  onDelete: (id: number) => void;
  onOpenDirectory: () => void;
  onViewApplications: () => void;
}) {
  return (
    <motion.div
      key={opening.id}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      {/* Header */}
      <div className="border-b border-border bg-secondary/30 p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-card text-2xl font-bold shadow-sm">
            {opening.title[0]}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Job Opening
            </p>
            <h4 className="mt-0.5 text-lg font-bold">{opening.title}</h4>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-5 overflow-y-auto p-5 text-sm">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Description
          </p>
          <p className="leading-relaxed text-muted-foreground">{opening.description}</p>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Requirements
          </p>
          <p className="leading-relaxed text-muted-foreground">{opening.requirements}</p>
        </div>
        {canEdit && (
          <button
            onClick={onViewApplications}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            View applications
            <ArrowRight size={15} />
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="grid grid-cols-2 gap-3 border-t border-border p-5">
        {canEdit && (
          <button
            onClick={() => onDelete(opening.id)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 size={15} />
            Delete
          </button>
        )}
        <button
          onClick={onOpenDirectory}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:opacity-90 transition-opacity",
            !canEdit && "col-span-2"
          )}
        >
          Open directory
          <ArrowRight size={15} />
        </button>
      </div>
    </motion.div>
  );
}

function EmptyDetail() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center">
      <User size={28} className="mb-3 text-muted-foreground opacity-20" />
      <p className="text-sm text-muted-foreground">Select a job opening to view details.</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Recruitment() {
  const [openings, setOpenings] = React.useState<JobOpeningRecord[]>([]);
  const [selectedOpening, setSelectedOpening] = React.useState<JobOpeningRecord | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ title: "", description: "", requirements: "" });

  const { user } = useAuth();
  const router = useRouter();
  const role = user?.role || "";
  const departmentName = user?.department_name ?? null;
  const isAdmin = role === "Administrator";
  const isHrUser = role === "HR";
  const isHrManager = role === "Manager" && ["hr", "human resources"].includes(departmentName?.trim().toLowerCase() ?? "");
  const canEdit = isAdmin || isHrUser || isHrManager;

  // ─── Data fetching ───────────────────────────────────────────────────────

  const loadOpenings = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<JobOpeningRecord[]>("/job-openings");
      setOpenings(data ?? []);
      setSelectedOpening((current) => {
        if (!data || data.length === 0) return null;
        if (current && data.some((o) => o.id === current.id)) {
          return data.find((o) => o.id === current.id) ?? data[0];
        }
        return data[0];
      });
      setError(null);
    } catch (err) {
      console.error("Failed to fetch openings:", err);
      setError("Could not load recruitment data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadOpenings();
  }, [loadOpenings]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await api.post("/job-openings", form);
      setForm({ title: "", description: "", requirements: "" });
      await loadOpenings();
    } catch (err) {
      console.error("Create opening failed:", err);
      alert("Failed to create the opening. Please ensure the backend is running.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (openingId: number) => {
    try {
      await api.delete(`/job-openings/${openingId}`);
      await loadOpenings();
    } catch (err) {
      console.error("Delete opening failed:", err);
      alert("Failed to delete the opening.");
    }
  };

  // ─── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <h2 className="text-3xl font-bold tracking-tight">Job openings</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Track active roles, review opening details, and keep hiring updates in one place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
            <p className="text-xs uppercase tracking-widest text-muted-foreground m-0.5 font-semibold">Open roles: {openings.length}</p>
          </div>
          <button
            onClick={loadOpenings}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          {canEdit && (
            <button
              onClick={() => router.push("/employee-directory")}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:opacity-90 transition-opacity"
            >
              <Plus size={15} />
              New hire
            </button>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column */}
        <div className="flex flex-col gap-5 lg:col-span-8">
          {/* Create opening form */}
          {canEdit && (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-semibold">Create opening</h4>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Publish a new role for the hiring team.
                  </p>
                </div>
              </div>

              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Job title"
                className="h-10 w-full rounded-xl border border-border bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description"
                className="min-h-24 w-full resize-none rounded-xl border border-border bg-background p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <textarea
                value={form.requirements}
                onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                placeholder="Requirements"
                className="min-h-20 w-full resize-none rounded-xl border border-border bg-background p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 disabled:opacity-50"
              >
                <Plus size={15} />
                {isSaving ? "Saving…" : "Save opening"}
              </button>
            </form>
          )}

          {/* Openings list */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h3 className="font-semibold">Open positions</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Select a role to review its details.
                </p>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {openings.length} total
              </span>
            </div>

            <div className="overflow-y-auto">
              {error ? (
                <div className="flex flex-col items-center justify-center p-10 text-center text-destructive">
                  <AlertCircle size={28} className="mb-2 opacity-50" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              ) : openings.length > 0 ? (
                openings.map((opening) => (
                  <OpeningRow
                    key={opening.id}
                    opening={opening}
                    isSelected={selectedOpening?.id === opening.id}
                    onSelect={() => setSelectedOpening(opening)}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText size={28} className="mb-2 text-muted-foreground opacity-20" />
                  <p className="text-sm text-muted-foreground">No openings tracked yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column — detail panel */}
        <div className="lg:col-span-4">
          <AnimatePresence mode="wait">
            {selectedOpening ? (
              <DetailPanel
                key={selectedOpening.id}
                opening={selectedOpening}
                canEdit={canEdit}
                onDelete={handleDelete}
                onOpenDirectory={() => router.push("/employee-directory")}
                onViewApplications={() => router.push(`/recruitment/applications/${selectedOpening.id}`)}
              />
            ) : (
              <EmptyDetail />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}