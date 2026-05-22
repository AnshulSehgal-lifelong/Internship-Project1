"use client";

import React from "react";
import { Building2, Crown, Mail, Users } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DepartmentMember {
  id: number;
  name: string;
  role: string | null;
  email: string;
  is_active: boolean;
}

interface DepartmentOverviewResponse {
  id: number;
  name: string;
  manager: {
    id: number;
    name: string;
    role: string | null;
    email: string;
  } | null;
  members: DepartmentMember[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MemberCard({
  member,
  isManager,
}: {
  member: DepartmentMember;
  isManager: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border p-4",
        isManager
          ? "border-primary/20 bg-primary/5"
          : member.is_active
          ? "border-border/60 bg-secondary/20"
          : "border-amber-500/20 bg-amber-500/5"
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{member.name}</p>
          {isManager && (
            <Crown size={12} className="shrink-0 text-amber-500" />
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{member.role ?? "Employee"}</p>
        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Mail size={11} className="opacity-50" />
          <span className="truncate">{member.email}</span>
        </div>
      </div>

      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
          member.is_active
            ? "bg-emerald-500/10 text-emerald-600"
            : "bg-amber-500/10 text-amber-600"
        )}
      >
        {member.is_active ? "Active" : "Inactive"}
      </span>
    </div>
  );
}

// ─── Loading / Error states ───────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-16 text-center">
      <Building2 size={32} className="mb-3 text-muted-foreground opacity-20" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DepartmentOverview() {
  const [department, setDepartment] = React.useState<DepartmentOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadDepartment() {
      setIsLoading(true);
      try {
        const data = await api.get<DepartmentOverviewResponse>("/departments/my");
        setDepartment(data ?? null);
        setError(null);
      } catch (err) {
        console.error("Failed to load department:", err);
        setDepartment(null);
        setError("No department assigned yet.");
      } finally {
        setIsLoading(false);
      }
    }
    void loadDepartment();
  }, []);

  if (isLoading) return <LoadingState />;
  if (!department) return <EmptyState message={error ?? "No department information available."} />;

  const activeCount = department.members.filter((m) => m.is_active).length;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">My department</h2>
        <p className="mt-1 text-sm text-muted-foreground">Team details and leadership.</p>
      </div>

      {/* Department header card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-secondary/30 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold">{department.name}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {activeCount} active · {department.members.length} total members
              </p>
            </div>
          </div>
        </div>

        {/* Manager section */}
        <div className="px-6 py-5">
          <div className="mb-3 flex items-center gap-2">
            <Crown size={14} className="text-amber-500" />
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Department manager
            </p>
          </div>

          {department.manager ? (
            <div className="flex items-start gap-4 rounded-xl border border-border/60 bg-secondary/20 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-sm font-bold text-amber-600">
                {department.manager.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold">{department.manager.name}</p>
                <p className="text-xs text-muted-foreground">{department.manager.role ?? "Manager"}</p>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail size={11} className="opacity-50" />
                  {department.manager.email}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No manager assigned yet.</p>
          )}
        </div>
      </div>

      {/* Team members */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-primary" />
            <h3 className="font-semibold">Team members</h3>
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {department.members.length}
          </span>
        </div>

        <div className="p-5">
          {department.members.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {department.members.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  isManager={member.id === department.manager?.id}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No team members assigned yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}