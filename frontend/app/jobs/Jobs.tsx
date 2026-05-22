"use client";

import React from "react";
import {
  AlertCircle,
  Briefcase,
  Check,
  ChevronRight,
  FileText,
  Globe,
  Link as LinkIcon,
  Mail,
  MapPin,
  Phone,
  Upload,
  User,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobOpeningRecord {
  id: number;
  title: string;
  description: string;
  requirements: string;
}

interface ApplicationForm {
  fullName: string;
  email: string;
  phone: string;
  githubUrl: string;
  linkedinUrl: string;
  portfolioUrl: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM: ApplicationForm = {
  fullName: "",
  email: "",
  phone: "",
  githubUrl: "",
  linkedinUrl: "",
  portfolioUrl: "",
};

const PERKS = [
  { icon: Zap, label: "Fast hiring process" },
  { icon: MapPin, label: "Remote-friendly" },
  { icon: Briefcase, label: "Competitive pay" },
];

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputWrapCls =
  "flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20";

const inputCls =
  "h-10 w-full bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/40";

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
        "flex w-full items-center gap-4 border-b border-border/50 px-5 py-4 text-left transition-all last:border-0",
        isSelected
          ? "border-l-[3px] border-l-primary bg-primary/5"
          : "hover:bg-secondary/40"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-colors",
          isSelected ? "bg-primary text-primary-foreground" : "bg-secondary"
        )}
      >
        {opening.title[0]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">{opening.title}</p>
          <span className="shrink-0 text-[10px] text-muted-foreground">#{opening.id}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {opening.requirements?.slice(0, 72)}
        </p>
      </div>
      <ChevronRight
        size={14}
        className={cn(
          "shrink-0 transition-colors",
          isSelected ? "text-primary" : "text-muted-foreground/40"
        )}
      />
    </button>
  );
}

function FormField({
  label,
  icon,
  required,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
        {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Jobs() {
  const [openings, setOpenings] = React.useState<JobOpeningRecord[]>([]);
  const [selectedOpening, setSelectedOpening] = React.useState<JobOpeningRecord | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState<ApplicationForm>(EMPTY_FORM);
  const [resumeFile, setResumeFile] = React.useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // ─── Data fetching ───────────────────────────────────────────────────────

  const loadOpenings = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<JobOpeningRecord[]>("/job-openings/public");
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
      setError("Could not load job openings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadOpenings();
  }, [loadOpenings]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleChange =
    (field: keyof ApplicationForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    if (!selectedOpening) {
      setSubmitError("Please select a job opening before applying.");
      return;
    }
    if (!resumeFile) {
      setSubmitError("Please upload your resume before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("full_name", form.fullName);
      formData.append("email", form.email);
      formData.append("phone", form.phone);
      if (form.githubUrl) formData.append("github_url", form.githubUrl);
      if (form.linkedinUrl) formData.append("linkedin_url", form.linkedinUrl);
      if (form.portfolioUrl) formData.append("portfolio_url", form.portfolioUrl);
      formData.append("resume", resumeFile);

      await api.upload(`/job-openings/${selectedOpening.id}/apply`, formData);

      setForm(EMPTY_FORM);
      setResumeFile(null);
      setSubmitSuccess(true);
    } catch (err) {
      console.error("Apply failed:", err);
      setSubmitError("Failed to submit application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-12 md:px-10 md:py-16">
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Join our team
              </h1>
              <p className="mt-3 max-w-lg text-base text-muted-foreground">
                Explore open roles and apply in minutes. We review every application
                and respond to qualified candidates.
              </p>
            </div>
          </div>

          {/* Live count badge */}
          {!isLoading && openings.length > 0 && (
            <div className="shrink-0 rounded-2xl border border-border bg-card px-6 py-4 text-center shadow-sm">
              <p className="text-3xl font-bold">{openings.length}</p>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                open {openings.length === 1 ? "role" : "roles"}
              </p>
            </div>
          )}
        </div>

        {/* ── Main grid ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left — openings list */}
          <div className="lg:col-span-4">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-5 py-4">
                <h3 className="font-semibold">Open positions</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Select a role to view details and apply.
                </p>
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
              ) : openings.length > 0 ? (
                openings.map((opening) => (
                  <OpeningRow
                    key={opening.id}
                    opening={opening}
                    isSelected={selectedOpening?.id === opening.id}
                    onSelect={() => {
                      setSelectedOpening(opening);
                      setSubmitSuccess(false);
                      setSubmitError(null);
                    }}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText size={28} className="mb-2 text-muted-foreground opacity-20" />
                  <p className="text-sm text-muted-foreground">No openings right now.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Check back soon.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right — detail + application form */}
          <div className="lg:col-span-8">
            {selectedOpening ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                {/* Role header */}
                <div className="border-b border-border bg-secondary/30 px-6 py-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground shadow-sm">
                      {selectedOpening.title[0]}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Open role · #{selectedOpening.id}
                      </p>
                      <h2 className="mt-0.5 text-xl font-bold">{selectedOpening.title}</h2>
                    </div>
                  </div>
                </div>

                {/* Role description */}
                <div className="grid gap-5 border-b border-border px-6 py-5 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Description
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {selectedOpening.description}
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Requirements
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {selectedOpening.requirements}
                    </p>
                  </div>
                </div>

                {/* Application form or success state */}
                {submitSuccess ? (
                  <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                      <Check size={28} />
                    </div>
                    <div>
                      <p className="text-lg font-bold">Application received!</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        We'll review your application and reach out if there's a match.
                      </p>
                    </div>
                    <button
                      onClick={() => setSubmitSuccess(false)}
                      className="mt-2 rounded-xl border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
                    >
                      Apply for another role
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Your details
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Fields marked <span className="text-rose-500">*</span> are required.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField label="Full name" icon={<User size={11} />} required>
                        <div className={inputWrapCls}>
                          <User size={14} className="shrink-0 text-muted-foreground" />
                          <input
                            required
                            value={form.fullName}
                            onChange={handleChange("fullName")}
                            placeholder="Jane Doe"
                            className={inputCls}
                          />
                        </div>
                      </FormField>

                      <FormField label="Email" icon={<Mail size={11} />} required>
                        <div className={inputWrapCls}>
                          <Mail size={14} className="shrink-0 text-muted-foreground" />
                          <input
                            required
                            type="email"
                            value={form.email}
                            onChange={handleChange("email")}
                            placeholder="jane@email.com"
                            className={inputCls}
                          />
                        </div>
                      </FormField>

                      <FormField label="Phone" icon={<Phone size={11} />} required>
                        <div className={inputWrapCls}>
                          <Phone size={14} className="shrink-0 text-muted-foreground" />
                          <input
                            required
                            value={form.phone}
                            onChange={handleChange("phone")}
                            placeholder="+91 98765 43210"
                            className={inputCls}
                          />
                        </div>
                      </FormField>

                      <FormField label="Portfolio" icon={<Globe size={11} />}>
                        <div className={inputWrapCls}>
                          <Globe size={14} className="shrink-0 text-muted-foreground" />
                          <input
                            value={form.portfolioUrl}
                            onChange={handleChange("portfolioUrl")}
                            placeholder="https://yoursite.com"
                            className={inputCls}
                          />
                        </div>
                      </FormField>

                      <FormField label="GitHub" icon={<LinkIcon size={11} />}>
                        <div className={inputWrapCls}>
                          <LinkIcon size={14} className="shrink-0 text-muted-foreground" />
                          <input
                            value={form.githubUrl}
                            onChange={handleChange("githubUrl")}
                            placeholder="https://github.com/username"
                            className={inputCls}
                          />
                        </div>
                      </FormField>

                      <FormField label="LinkedIn" icon={<LinkIcon size={11} />}>
                        <div className={inputWrapCls}>
                          <LinkIcon size={14} className="shrink-0 text-muted-foreground" />
                          <input
                            value={form.linkedinUrl}
                            onChange={handleChange("linkedinUrl")}
                            placeholder="https://linkedin.com/in/username"
                            className={inputCls}
                          />
                        </div>
                      </FormField>
                    </div>

                    {/* Resume upload */}
                    <FormField label="Resume" icon={<Upload size={11} />} required>
                      <div
                        className={cn(
                          "flex flex-col gap-3 rounded-xl border border-dashed border-border bg-secondary/20 px-5 py-4 transition-colors",
                          resumeFile && "border-primary/30 bg-primary/5"
                        )}
                      >
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Upload size={13} />
                          <span>PDF or DOCX — up to 25 MB</span>
                        </div>
                        <input
                          required
                          type="file"
                          accept=".pdf,.doc,.docx,.txt"
                          onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                          className="text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-secondary"
                        />
                        {resumeFile && (
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                            <Check size={11} />
                            {resumeFile.name}
                          </p>
                        )}
                      </div>
                    </FormField>

                    {/* Error */}
                    {submitError && (
                      <div className="flex items-center gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        <AlertCircle size={14} className="shrink-0" />
                        {submitError}
                      </div>
                    )}

                    {/* Submit */}
                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                            Submitting…
                          </>
                        ) : (
                          "Submit application"
                        )}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        We respond to every qualified candidate.
                      </p>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="flex h-full min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                  <Briefcase size={22} className="text-muted-foreground opacity-40" />
                </div>
                <p className="font-semibold">No role selected</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Choose a position from the list to view details and submit your application.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}