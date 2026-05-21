"use client";

import React from "react";
import {
  Search,
  UserPlus,
  Users,
  AlertCircle,
  Trash2,
  User,
  Building2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth-context";
import { useSearchParams } from "next/navigation";
import AddEmployeePanel, {
  AddEmployeeForm,
  DepartmentRecord,
  EMPTY_EMPLOYEE_FORM,
} from "@/components/AddEmployeePanel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeRecord {
  id: number;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  department_id: number | null;
  department_name?: string | null;
  role: string | null;
  salary?: number | null;
  hire_date: string | null;
  is_active: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-violet-500/20 text-violet-400",
  "bg-blue-500/20 text-blue-400",
  "bg-emerald-500/20 text-emerald-400",
  "bg-amber-500/20 text-amber-400",
  "bg-rose-500/20 text-rose-400",
  "bg-cyan-500/20 text-cyan-400",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAvatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}


// ─── Employee row ─────────────────────────────────────────────────────────────

function EmployeeRow({
  emp,
  idx,
  canManage,
  deleteConfirm,
  onDeleteRequest,
  onDeleteCancel,
  onDeleteConfirm,
}: {
  emp: EmployeeRecord;
  idx: number;
  canManage: boolean;
  deleteConfirm: number | null;
  onDeleteRequest: (id: number) => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: (id: number) => void;
}) {
  return (
    <motion.tr
      key={emp.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: idx * 0.04, duration: 0.2 }}
      className="transition-colors hover:bg-secondary/30"
    >
      {/* Employee */}
      <td className="px-5 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(emp.id)}`}
          >
            {getInitials(emp.name || "?")}
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{emp.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{emp.email}</p>
          </div>
        </div>
      </td>

      {/* Department */}
      <td className="hidden px-5 py-4 whitespace-nowrap text-sm text-muted-foreground md:table-cell">
        <div className="flex items-center gap-1.5">
          <Building2 size={13} className="opacity-40" />
          {emp.department_name ?? <span className="text-border">—</span>}
        </div>
      </td>

      {/* Role */}
      <td className="hidden px-5 py-4 whitespace-nowrap lg:table-cell">
        {emp.role ? (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {emp.role}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>

      {/* Salary */}
      <td className="hidden px-5 py-4 whitespace-nowrap text-sm lg:table-cell">
        {emp.salary != null ? (
          <span className="font-medium">₹{emp.salary.toLocaleString("en-IN")}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-5 py-4 whitespace-nowrap">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            emp.is_active
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-amber-500/10 text-amber-500"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${emp.is_active ? "bg-emerald-500" : "bg-amber-500"}`} />
          {emp.is_active ? "Active" : "Inactive"}
        </span>
      </td>

      {/* Actions */}
      {canManage && (
        <td className="px-5 py-4 whitespace-nowrap text-right">
          {deleteConfirm === emp.id ? (
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">Sure?</span>
              <button
                onClick={() => onDeleteConfirm(emp.id)}
                className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Delete
              </button>
              <button
                onClick={onDeleteCancel}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-secondary"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => onDeleteRequest(emp.id)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 size={14} />
            </button>
          )}
        </td>
      )}
    </motion.tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EmployeeDirectory() {
  const [employees, setEmployees] = React.useState<EmployeeRecord[]>([]);
  const [departments, setDepartments] = React.useState<DepartmentRecord[]>([]);
  const [total, setTotal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [showModal, setShowModal] = React.useState(false);
  const [form, setForm] = React.useState<AddEmployeeForm>(EMPTY_EMPLOYEE_FORM);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState<number | null>(null);

  const { user } = useAuth();
  const searchParams = useSearchParams();
  const role = user?.role || "";
  const departmentName = user?.department_name ?? null;
  const isAdmin = role === "Administrator";
  const isHrManager = role === "Manager" && ["hr", "human resources"].includes(departmentName?.trim().toLowerCase() ?? "");
  const canManage = isAdmin || isHrManager;

  // ─── Effects ──────────────────────────────────────────────────────────────

  React.useEffect(() => {
    setSearch(searchParams.get("search") ?? "");
  }, [searchParams]);

  const loadEmployees = React.useCallback(async () => {
    try {
      const [employeeData, departmentData] = await Promise.all([
        api.get<EmployeeRecord[]>(
          search ? `/employees?search=${encodeURIComponent(search)}` : "/employees"
        ),
        api.get<DepartmentRecord[]>("/departments"),
      ]);
      setEmployees(employeeData ?? []);
      setDepartments(departmentData ?? []);
      setTotal(employeeData?.length ?? 0);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
      setError("Could not load employee data. Check your connection.");
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    const timer = setTimeout(loadEmployees, 300);
    return () => clearTimeout(timer);
  }, [loadEmployees]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setTimeout(() => {
        setSaveSuccess(false);
        setShowModal(false);
        setForm(EMPTY_EMPLOYEE_FORM);
      }, 1200);
      await loadEmployees();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not create employee. Please try again.";
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (employeeId: number) => {
    try {
      await api.delete(`/employees/${employeeId}`);
      setDeleteConfirm(null);
      await loadEmployees();
    } catch (err) {
      console.error("Failed to delete employee:", err);
    }
  };

  const openModal = () => {
    setForm(EMPTY_EMPLOYEE_FORM);
    setFormError(null);
    setSaveSuccess(false);
    setShowModal(true);
  };

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (isLoading && employees.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading employees…</p>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Employee directory</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {total} {total === 1 ? "member" : "members"} in your organisation
            </p>
          </div>
          {canManage && (
            <button
              onClick={openModal}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-90 active:scale-95"
            >
              <UserPlus size={16} />
              Add employee
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, role, or department…"
            className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Table */}
        {!error && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {employees.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border bg-secondary/40">
                        {["Employee", "Department", "Role", "Salary", "Status"].map((col, i) => (
                          <th
                            key={col}
                            className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${
                              i === 1 ? "hidden md:table-cell" :
                              i === 2 || i === 3 ? "hidden lg:table-cell" : ""
                            }`}
                          >
                            {col}
                          </th>
                        ))}
                        {canManage && (
                          <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <AnimatePresence>
                        {employees.map((emp, idx) => (
                          <EmployeeRow
                            key={emp.id}
                            emp={emp}
                            idx={idx}
                            canManage={canManage}
                            deleteConfirm={deleteConfirm}
                            onDeleteRequest={setDeleteConfirm}
                            onDeleteCancel={() => setDeleteConfirm(null)}
                            onDeleteConfirm={handleDelete}
                          />
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between border-t border-border bg-secondary/20 px-5 py-3">
                  <p className="text-xs text-muted-foreground">
                    Showing{" "}
                    <span className="font-semibold text-foreground">{employees.length}</span>
                    {" "}of{" "}
                    <span className="font-semibold text-foreground">{total}</span>
                    {" "}employees
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                  <Users size={24} className="text-muted-foreground opacity-40" />
                </div>
                <h3 className="text-lg font-semibold">
                  {search ? "No results found" : "No employees yet"}
                </h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {search
                    ? `No employees match "${search}". Try a different search.`
                    : canManage
                    ? 'Click "Add employee" to create the first account.'
                    : "No employees have been added yet."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add employee panel */}
      <AnimatePresence>
        {showModal && (
          <AddEmployeePanel
            form={form}
            departments={departments}
            isSaving={isSaving}
            saveSuccess={saveSuccess}
            formError={formError}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}