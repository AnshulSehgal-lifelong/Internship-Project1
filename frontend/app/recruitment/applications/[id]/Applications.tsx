"use client";

import React from "react";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Mail,
  Phone,
  User,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import AddEmployeePanel, {
  AddEmployeeForm,
  DepartmentRecord,
  EMPTY_EMPLOYEE_FORM,
} from "@/components/AddEmployeePanel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobApplicationRecord {
  id: number;
  job_opening_id: number;
  full_name: string;
  email: string;
  phone: string;
  github_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  resume_original_name: string;
  resume_mime_type: string;
  resume_size_bytes: number;
  status: "pending" | "selected" | "rejected";
  selected_at: string | null;
  rejected_at: string | null;
  created_at: string;
}

interface JobOpeningRecord {
  id: number;
  title: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function splitName(value: string): { first: string; last: string } {
  const parts = value.trim().split(/\s+/);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:  { label: "Pending",  cls: "bg-amber-500/10 text-amber-600" },
  selected: { label: "Selected", cls: "bg-emerald-500/10 text-emerald-600" },
  rejected: { label: "Rejected", cls: "bg-destructive/10 text-destructive" },
} satisfies Record<JobApplicationRecord["status"], { label: string; cls: string }>;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: JobApplicationRecord["status"] }) {
  const { label, cls } = STATUS_CONFIG[status];
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", cls)}>
      {label}
    </span>
  );
}

function ApplicantRow({
  application,
  isSelected,
  onSelect,
}: {
  application: JobApplicationRecord;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 border-b border-border/50 px-5 py-4 text-left transition-all last:border-0",
        isSelected
          ? "border-l-[3px] border-l-primary bg-primary/5"
          : "hover:bg-secondary/40"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
          isSelected ? "bg-primary text-primary-foreground" : "bg-secondary"
        )}
      >
        {application.full_name[0]}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{application.full_name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{application.email}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <StatusBadge status={application.status} />
        <ChevronRight
          size={13}
          className={cn(isSelected ? "text-primary" : "text-muted-foreground/30")}
        />
      </div>
    </button>
  );
}

function DetailRow({
  icon,
  label,
  value,
  href,
  colSpan,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  href?: string;
  colSpan?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background px-4 py-3",
        colSpan && "sm:col-span-2"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      {value ? (
        href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {icon}
            <span className="truncate">{value}</span>
            <ExternalLink size={11} className="shrink-0 opacity-60" />
          </a>
        ) : (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm">
            {icon}
            {value}
          </p>
        )
      ) : (
        <p className="mt-1.5 text-sm text-muted-foreground/50">—</p>
      )}
    </div>
  );
}

function ResumePreviewModal({
  fileName,
  previewUrl,
  isLoading,
  error,
  onClose,
}: {
  fileName: string;
  previewUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-5xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Resume preview
              </p>
              <p className="text-sm font-semibold">{fileName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-hidden bg-secondary/20 p-5">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center gap-2.5 text-sm text-muted-foreground">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading preview…
            </div>
          ) : previewUrl ? (
            <iframe
              title="Resume preview"
              src={previewUrl}
              className="h-full min-h-[75vh] w-full rounded-xl border border-border bg-background"
            />
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
              <FileText size={24} className="text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">
                {error ?? "Preview unavailable for this file type."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Applications() {
  const router = useRouter();
  const params = useParams();
  const jobId = Number(params?.id);

  // ─── Data state ───────────────────────────────────────────────────────────
  const [applications, setApplications] = React.useState<JobApplicationRecord[]>([]);
  const [selected, setSelected] = React.useState<JobApplicationRecord | null>(null);
  const [jobTitle, setJobTitle] = React.useState<string | null>(null);
  const [departments, setDepartments] = React.useState<DepartmentRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [decisionError, setDecisionError] = React.useState<string | null>(null);

  // ─── Resume preview state ─────────────────────────────────────────────────
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
  const [resumePreviewUrl, setResumePreviewUrl] = React.useState<string | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const previewUrlRef = React.useRef<string | null>(null);

  // ─── Add employee panel state ─────────────────────────────────────────────
  const [showAddEmployee, setShowAddEmployee] = React.useState(false);
  const [form, setForm] = React.useState<AddEmployeeForm>(EMPTY_EMPLOYEE_FORM);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // ─── Data fetching ────────────────────────────────────────────────────────

  const loadApplications = React.useCallback(async () => {
    if (!jobId || Number.isNaN(jobId)) {
      setError("Invalid job opening.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [opening, data] = await Promise.all([
        api.get<JobOpeningRecord>(`/job-openings/${jobId}`),
        api.get<JobApplicationRecord[]>(`/job-openings/${jobId}/applications`),
      ]);
      setJobTitle(opening?.title ?? null);
      setApplications(data ?? []);
      setSelected(data?.[0] ?? null);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch applications:", err);
      setError("Could not load applications.");
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  const loadDepartments = React.useCallback(async () => {
    try {
      const data = await api.get<DepartmentRecord[]>("/departments");
      setDepartments(data ?? []);
    } catch (err) {
      console.error("Failed to fetch departments:", err);
    }
  }, []);

  React.useEffect(() => { void loadApplications(); }, [loadApplications]);
  React.useEffect(() => { void loadDepartments(); }, [loadDepartments]);

  // ─── Resume preview ───────────────────────────────────────────────────────

  const closePreview = React.useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setResumePreviewUrl(null);
    setPreviewError(null);
    setIsPreviewLoading(false);
    setIsPreviewOpen(false);
  }, []);

  const openPreview = React.useCallback(async () => {
    if (!selected) return;
    setIsPreviewOpen(true);
    setPreviewError(null);
    setIsPreviewLoading(true);
    try {
      const blob = await api.fetchBlob(`/job-openings/applications/${selected.id}/resume`);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = URL.createObjectURL(blob);
      setResumePreviewUrl(previewUrlRef.current);
    } catch (err) {
      console.error("Failed to load resume:", err);
      setPreviewError("Preview unavailable for this file.");
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setResumePreviewUrl(null);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [selected]);

  // Cleanup blob URL on unmount
  React.useEffect(() => () => closePreview(), [closePreview]);

  // ─── Decision handler ─────────────────────────────────────────────────────

  const handleDecision = async (status: "selected" | "rejected") => {
    if (!selected) return;
    setDecisionError(null);
    try {
      const updated = await api.post<JobApplicationRecord>(
        `/job-openings/applications/${selected.id}/decision`,
        { status }
      );
      setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setSelected(updated);
    } catch (err) {
      console.error("Decision failed:", err);
      setDecisionError("Failed to update application status.");
    }
  };

  // ─── Add employee handlers ────────────────────────────────────────────────

  const openAddEmployee = () => {
    if (!selected) return;
    const { first, last } = splitName(selected.full_name);
    setForm({ ...EMPTY_EMPLOYEE_FORM, first_name: first, last_name: last, email: selected.email });
    setFormError(null);
    setSaveSuccess(false);
    setShowAddEmployee(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmitEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);
    try {
      await api.post("/employees", {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        department_id: form.department_id ? Number(form.department_id) : null,
        role: form.role || null,
        salary: form.salary ? Number(form.salary) : null,
        hire_date: form.hire_date || null,
      });
      setSaveSuccess(true);
      await handleDecision("selected");
      setTimeout(() => {
        setSaveSuccess(false);
        setShowAddEmployee(false);
        setForm(EMPTY_EMPLOYEE_FORM);
      }, 1200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not create employee. Please try again.";
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Computed counts ──────────────────────────────────────────────────────

  const counts = React.useMemo(() => ({
    total: applications.length,
    pending: applications.filter((a) => a.status === "pending").length,
    selected: applications.filter((a) => a.status === "selected").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  }), [applications]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Recruitment
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">
              {jobTitle ? `Applications — ${jobTitle}` : `Job opening #${jobId}`}
            </h2>
          </div>
          <button
            onClick={() => router.push("/recruitment")}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <ArrowLeft size={15} />
            Back to openings
          </button>
        </div>

        {/* Stats row */}
        {!isLoading && !error && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total",    value: counts.total,    cls: "text-foreground" },
              { label: "Pending",  value: counts.pending,  cls: "text-amber-600" },
              { label: "Selected", value: counts.selected, cls: "text-emerald-600" },
              { label: "Rejected", value: counts.rejected, cls: "text-destructive" },
            ].map(({ label, value, cls }) => (
              <div key={label} className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn("mt-1 text-xl font-bold", cls)}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left — applicants list */}
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <h3 className="font-semibold">Candidates</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Select an applicant to review.
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {counts.total} total
                </span>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center p-12">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center p-10 text-center text-destructive">
                  <AlertCircle size={24} className="mb-2 opacity-50" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              ) : applications.length > 0 ? (
                applications.map((application) => (
                  <ApplicantRow
                    key={application.id}
                    application={application}
                    isSelected={selected?.id === application.id}
                    onSelect={() => {
                      setSelected(application);
                      setDecisionError(null);
                    }}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText size={28} className="mb-2 text-muted-foreground opacity-20" />
                  <p className="text-sm font-medium">No applications yet</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Applications will appear here once candidates apply.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right — candidate detail */}
          <div className="lg:col-span-7">
            {selected ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                {/* Candidate header */}
                <div className="border-b border-border bg-secondary/30 px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                        {selected.full_name[0]}
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Candidate
                        </p>
                        <h3 className="mt-0.5 text-xl font-bold">{selected.full_name}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Applied {formatDate(selected.created_at)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={selected.status} />
                  </div>
                </div>

                {/* Contact details grid */}
                <div className="grid grid-cols-1 gap-3 px-6 py-5 sm:grid-cols-2">
                  <DetailRow
                    icon={<Mail size={13} className="shrink-0 text-muted-foreground" />}
                    label="Email"
                    value={selected.email}
                    href={`mailto:${selected.email}`}
                  />
                  <DetailRow
                    icon={<Phone size={13} className="shrink-0 text-muted-foreground" />}
                    label="Phone"
                    value={selected.phone}
                    href={`tel:${selected.phone}`}
                  />
                  <DetailRow
                    icon={<ExternalLink size={13} className="shrink-0 text-muted-foreground" />}
                    label="GitHub"
                    value={selected.github_url}
                    href={selected.github_url ?? undefined}
                  />
                  <DetailRow
                    icon={<ExternalLink size={13} className="shrink-0 text-muted-foreground" />}
                    label="LinkedIn"
                    value={selected.linkedin_url}
                    href={selected.linkedin_url ?? undefined}
                  />
                  <DetailRow
                    icon={<ExternalLink size={13} className="shrink-0 text-muted-foreground" />}
                    label="Portfolio"
                    value={selected.portfolio_url}
                    href={selected.portfolio_url ?? undefined}
                    colSpan
                  />
                </div>

                {/* Resume card */}
                <div className="mx-6 mb-5 flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/20 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText size={16} />
                    </div>
                    <div>
                      <button
                        onClick={openPreview}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        {selected.resume_original_name}
                      </button>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {selected.resume_mime_type} · {formatSize(selected.resume_size_bytes)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={openPreview}
                    className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
                  >
                    Preview
                  </button>
                </div>

                {/* Decision actions */}
                <div className="flex flex-wrap items-center gap-3 border-t border-border px-6 py-5">
                  <button
                    onClick={openAddEmployee}
                    disabled={selected.status === "selected"}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <UserCheck size={15} />
                    Select candidate
                  </button>
                  <button
                    onClick={() => handleDecision("rejected")}
                    disabled={selected.status === "rejected"}
                    className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <UserX size={15} />
                    Reject
                  </button>

                  {decisionError && (
                    <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      <AlertCircle size={13} className="shrink-0" />
                      {decisionError}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                  <User size={22} className="text-muted-foreground opacity-40" />
                </div>
                <p className="font-semibold">No candidate selected</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Choose a candidate from the list to review their application.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resume preview modal */}
      {isPreviewOpen && (
        <ResumePreviewModal
          fileName={selected?.resume_original_name ?? ""}
          previewUrl={resumePreviewUrl}
          isLoading={isPreviewLoading}
          error={previewError}
          onClose={closePreview}
        />
      )}

      {/* Add employee panel */}
      <AnimatePresence>
        {showAddEmployee && (
          <AddEmployeePanel
            form={form}
            departments={departments}
            isSaving={isSaving}
            saveSuccess={saveSuccess}
            formError={formError}
            onChange={handleFormChange}
            onSubmit={handleSubmitEmployee}
            onClose={() => {
              setShowAddEmployee(false);
              setForm(EMPTY_EMPLOYEE_FORM);
              setFormError(null);
            }}
            title="Add employee"
            subtitle="Finalize and add this candidate"
            submitLabel="Add employee"
          />
        )}
      </AnimatePresence>
    </>
  );
}