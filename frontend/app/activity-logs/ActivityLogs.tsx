"use client";

import React from "react";
import {
  AlertCircle,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  ChevronDown,
  Filter,
  History,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityLogRecord {
  id: number;
  initials: string;
  user: string;
  email: string;
  role: string | null;
  department_id: number | null;
  department_name: string | null;
  status: string;
  action: string;
  time: string;
  hire_date: string | null;
}

interface DepartmentRecord {
  id: number;
  name: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  "All roles",
  "Administrator", "HR", "Manager", "Engineer",
  "Designer", "Sales", "Finance", "Operations", "Other",
];

const STATUS_OPTIONS = ["All statuses", "Active", "Inactive"];

const SORT_OPTIONS = [
  { label: "Most recent", value: "recent" },
  { label: "Oldest first", value: "oldest" },
  { label: "Name", value: "name" },
  { label: "Role", value: "role" },
  { label: "Department", value: "department" },
  { label: "Status", value: "status" },
];

// ─── Shared styles ────────────────────────────────────────────────────────────

const selectCls =
  "h-10 w-full appearance-none rounded-xl border border-border bg-background px-4 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors";

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  Icon,
  tone,
}: {
  label: string;
  value: number;
  Icon: React.ComponentType<{ size?: number }>;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        </div>
        <div className={cn("rounded-xl p-2.5", tone)}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status.toLowerCase() === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        isActive
          ? "bg-emerald-500/10 text-emerald-600"
          : "bg-amber-500/10 text-amber-600"
      )}
    >
      {isActive ? <CheckCircle2 size={11} /> : <History size={11} />}
      {status}
    </span>
  );
}

function SelectField({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={onChange} className={selectCls}>
        {children}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

function LogRow({ log }: { log: ActivityLogRecord }) {
  return (
    <tr className="transition-colors hover:bg-secondary/30">
      {/* Employee */}
      <td className="px-5 py-3.5 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
            {log.initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{log.user}</p>
            <p className="truncate text-xs text-muted-foreground">{log.email}</p>
          </div>
        </div>
      </td>

      {/* Department */}
      <td className="hidden px-5 py-3.5 whitespace-nowrap text-sm text-muted-foreground md:table-cell">
        {log.department_name ?? "—"}
      </td>

      {/* Role */}
      <td className="hidden px-5 py-3.5 whitespace-nowrap lg:table-cell">
        {log.role ? (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {log.role}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-5 py-3.5 whitespace-nowrap">
        <StatusBadge status={log.status} />
      </td>

      {/* Joined */}
      <td className="hidden px-5 py-3.5 whitespace-nowrap text-sm text-muted-foreground xl:table-cell">
        {log.hire_date ?? "—"}
      </td>

      {/* Activity */}
      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-muted-foreground">
        {log.action}
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ActivityLogs() {
  const [logs, setLogs] = React.useState<ActivityLogRecord[]>([]);
  const [departments, setDepartments] = React.useState<DepartmentRecord[]>([]);
  const [search, setSearch] = React.useState("");
  const [role, setRole] = React.useState("All roles");
  const [status, setStatus] = React.useState("All statuses");
  const [departmentId, setDepartmentId] = React.useState("all");
  const [sortBy, setSortBy] = React.useState("recent");
  const [order, setOrder] = React.useState("desc");
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // ─── Data fetching ───────────────────────────────────────────────────────

  const loadDepartments = React.useCallback(async () => {
    try {
      const data = await api.get<DepartmentRecord[]>("/departments");
      setDepartments(data ?? []);
    } catch (err) {
      console.error("Failed to load departments:", err);
    }
  }, []);

  const loadLogs = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (role !== "All roles") params.set("role", role);
      if (status !== "All statuses") params.set("status", status.toLowerCase());
      if (departmentId !== "all") params.set("department_id", departmentId);
      params.set("sort_by", sortBy);
      params.set("order", order);

      const data = await api.get<ActivityLogRecord[]>(
        `/dashboard/activity-logs?${params.toString()}`
      );
      setLogs(data ?? []);
      setError(null);
    } catch (err) {
      console.error("Failed to load activity logs:", err);
      setError("Could not load activity logs.");
    } finally {
      setIsLoading(false);
    }
  }, [departmentId, order, role, search, sortBy, status]);

  React.useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void loadLogs(), 180);
    return () => window.clearTimeout(timer);
  }, [loadLogs]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const resetFilters = () => {
    setSearch("");
    setRole("All roles");
    setStatus("All statuses");
    setDepartmentId("all");
    setSortBy("recent");
    setOrder("desc");
  };

  const toggleOrder = () => setOrder((o) => (o === "desc" ? "asc" : "desc"));

  // ─── Derived ─────────────────────────────────────────────────────────────

  const activeCount = logs.filter((l) => l.status === "Active").length;
  const inactiveCount = logs.filter((l) => l.status === "Inactive").length;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <h2 className="text-3xl font-bold tracking-tight">Activity logs</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Search, sort, and filter the full activity feed that powers the dashboard's recent updates.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <MetricCard label="Total records" value={logs.length} Icon={History} tone="bg-primary/10 text-primary" />
        <MetricCard label="Active" value={activeCount} Icon={CheckCircle2} tone="bg-emerald-500/10 text-emerald-600" />
        <MetricCard label="Inactive" value={inactiveCount} Icon={Users} tone="bg-amber-500/10 text-amber-600" />
        <MetricCard label="Departments" value={departments.length} Icon={Building2} tone="bg-violet-500/10 text-violet-600" />
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-12">
          {/* Search */}
          <div className="relative xl:col-span-4">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, role, or department…"
              className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Filters */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:col-span-8 xl:grid-cols-7">
            <SelectField value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </SelectField>

            <SelectField value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </SelectField>

            <SelectField value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="all">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </SelectField>

            <SelectField value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectField>

            <button
              onClick={toggleOrder}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-secondary"
            >
              {/* <ArrowUpDown size={14} /> */}
              {order === "desc" ? "Newest" : "Oldest"}
            </button>

            <button
              onClick={resetFilters}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-secondary"
            >
              {/* <Filter size={14} /> */}
              Reset
            </button>

            <button
              onClick={loadLogs}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-opacity hover:opacity-90"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex min-h-96 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : logs.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-border bg-secondary/40">
                  <tr>
                    {["Employee", "Department", "Role", "Status", "Joined", "Activity"].map(
                      (col, i) => (
                        <th
                          key={col}
                          className={cn(
                            "px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                            i === 1 && "hidden md:table-cell",
                            i === 2 && "hidden lg:table-cell",
                            i === 4 && "hidden xl:table-cell"
                          )}
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => <LogRow key={log.id} log={log} />)}
                </tbody>
              </table>
            </div>

            <div className="border-t border-border bg-secondary/20 px-5 py-3">
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                <span className="font-semibold text-foreground">{logs.length}</span>
                {" "}records
              </p>
            </div>
          </>
        ) : (
          <div className="flex min-h-96 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
              <History size={24} className="text-muted-foreground opacity-40" />
            </div>
            <h3 className="text-lg font-semibold">No activity found</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Try clearing a filter or changing the search term to broaden results.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}