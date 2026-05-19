"use client";

import React from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth-context";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DepartmentRecord {
  id: number;
  name: string;
  manager_id: number | null;
}

interface EmployeeRecord {
  id: number;
  name: string;
  department_id: number | null;
  department_name?: string | null;
  role?: string | null;
  is_active: boolean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DepartmentRow({
  department,
  employeeCount,
  managerName,
  isActive,
  onSelect,
}: {
  department: DepartmentRecord;
  employeeCount: number;
  managerName: string | null;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between gap-4 border-b border-border/50 px-5 py-4 text-left transition-colors last:border-0",
        isActive ? "bg-primary/5" : "hover:bg-secondary/40"
      )}
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-sm">{department.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{employeeCount} employees</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <UserCheck
          size={13}
          className={managerName ? "text-emerald-500" : "text-muted-foreground"}
        />
        <span className="max-w-28 truncate">{managerName ?? "No manager"}</span>
      </div>
    </button>
  );
}

function EmployeeTag({
  employee,
  isManager,
}: {
  employee: EmployeeRecord;
  isManager: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border p-3.5 text-sm",
        isManager ? "border-primary/30 bg-primary/5" : "border-border bg-card"
      )}
    >
      <div>
        <p className="font-medium">{employee.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{employee.role ?? "Employee"}</p>
      </div>
      <span
        className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-medium",
          isManager
            ? "bg-primary text-primary-foreground"
            : employee.is_active
            ? "bg-emerald-500/10 text-emerald-600"
            : "bg-amber-500/10 text-amber-600"
        )}
      >
        {isManager ? "Manager" : employee.is_active ? "Active" : "Inactive"}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DepartmentsAdmin() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "Administrator";

  const [departments, setDepartments] = React.useState<DepartmentRecord[]>([]);
  const [employees, setEmployees] = React.useState<EmployeeRecord[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = React.useState<number | null>(null);
  const [departmentName, setDepartmentName] = React.useState("");
  const [managerId, setManagerId] = React.useState<string>("");
  const [newDepartmentName, setNewDepartmentName] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // ─── Derived state ────────────────────────────────────────────────────────

  const selectedDepartment = React.useMemo(
    () => departments.find((d) => d.id === selectedDepartmentId) ?? null,
    [departments, selectedDepartmentId]
  );

  const selectedDepartmentEmployees = React.useMemo(
    () => employees.filter((e) => e.department_id === selectedDepartmentId),
    [employees, selectedDepartmentId]
  );

  const employeeById = React.useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees]
  );

  const managerName = selectedDepartment?.manager_id
    ? (employeeById.get(selectedDepartment.manager_id)?.name ?? "Unknown")
    : "Unassigned";

  // ─── Data fetching ────────────────────────────────────────────────────────

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [departmentData, employeeData] = await Promise.all([
        api.get<DepartmentRecord[]>("/departments"),
        api.get<EmployeeRecord[]>("/employees"),
      ]);

      setDepartments(departmentData ?? []);
      setEmployees(employeeData ?? []);
      setSelectedDepartmentId((current) => {
        if (current && (departmentData ?? []).some((d) => d.id === current)) return current;
        return departmentData?.[0]?.id ?? null;
      });
      setError(null);
    } catch (err) {
      console.error("Failed to load departments:", err);
      setError("Could not load departments.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ─── Effects ──────────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!authLoading && user && !isAdmin) router.replace("/dashboard");
  }, [authLoading, isAdmin, router, user]);

  React.useEffect(() => {
    if (isAdmin) void loadData();
  }, [isAdmin, loadData]);

  React.useEffect(() => {
    if (!selectedDepartment) {
      setDepartmentName("");
      setManagerId("");
      return;
    }
    setDepartmentName(selectedDepartment.name);
    setManagerId(selectedDepartment.manager_id ? String(selectedDepartment.manager_id) : "");
  }, [selectedDepartment]);

  // ─── Guards ───────────────────────────────────────────────────────────────

  if (authLoading || isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-[70vh] items-center justify-center px-6 text-center">
        <div className="max-w-sm space-y-4 rounded-2xl border border-border bg-card p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertCircle size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Admin access required</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              This page is only available to administrators.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20"
          >
            Go to dashboard
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleCreateDepartment = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = newDepartmentName.trim();
    if (!trimmedName) return;

    setIsSaving(true);
    try {
      const created = await api.post<DepartmentRecord>("/departments", { name: trimmedName });
      setDepartments((prev) => [...prev, created]);
      setSelectedDepartmentId(created.id);
      setNewDepartmentName("");
    } catch (err) {
      console.error("Failed to create department:", err);
      alert("Could not create the department.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDepartment = async () => {
    if (!selectedDepartment) return;

    setIsSaving(true);
    try {
      const payload: { name: string; manager_id?: number | null } = {
        name: departmentName.trim(),
        manager_id: managerId ? Number(managerId) : null,
      };
      const updated = await api.put<DepartmentRecord>(
        `/departments/${selectedDepartment.id}`,
        payload
      );
      setDepartments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setSelectedDepartmentId(updated.id);
    } catch (err) {
      console.error("Failed to save department:", err);
      alert("Could not save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const fieldCls =
    "h-10 w-full rounded-xl border border-border bg-card px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";
  const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted-foreground";

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <h2 className="text-3xl font-bold tracking-tight">Departments</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Create departments, rename them, and assign managers from employees already in that department.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold m-0.5">Total: {departments.length}</p>
          </div>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left sidebar */}
        <div className="space-y-5 xl:col-span-4">
          {/* Create form */}
          <form
            onSubmit={handleCreateDepartment}
            className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div>
              <h3 className="font-semibold">Create department</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Add a new department, then assign its manager.
              </p>
            </div>
            <input
              value={newDepartmentName}
              onChange={(e) => setNewDepartmentName(e.target.value)}
              placeholder="e.g. Product Design"
              className={fieldCls}
            />
            <button
              type="submit"
              disabled={isSaving || !newDepartmentName.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={15} />
              Create
            </button>
          </form>

          {/* Department list */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-3.5">
              <h3 className="font-semibold text-sm">Departments</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {departments.length > 0 ? (
                departments.map((dept) => {
                  const count = employees.filter((e) => e.department_id === dept.id).length;
                  const manager = dept.manager_id ? employeeById.get(dept.manager_id) : null;

                  return (
                    <DepartmentRow
                      key={dept.id}
                      department={dept}
                      employeeCount={count}
                      managerName={manager?.name ?? null}
                      isActive={selectedDepartmentId === dept.id}
                      onSelect={() => setSelectedDepartmentId(dept.id)}
                    />
                  );
                })
              ) : (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  No departments yet.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="xl:col-span-8">
          {selectedDepartment ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {/* Panel header */}
              <div className="border-b border-border p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Building2 size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Selected department
                      </p>
                      <h3 className="mt-0.5 text-xl font-bold">{selectedDepartment.name}</h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Manager: {managerName}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={loadData}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
                  >
                    <RefreshCw size={14} />
                    Sync
                  </button>
                </div>
              </div>

              {/* Panel body */}
              <div className="grid gap-5 p-5 lg:grid-cols-2">
                {/* Edit form */}
                <div className="space-y-4 rounded-xl border border-border bg-background p-5">
                  <div>
                    <h4 className="font-semibold">Edit details</h4>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Rename the department or reassign its manager.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className={labelCls}>Department name</label>
                      <input
                        value={departmentName}
                        onChange={(e) => setDepartmentName(e.target.value)}
                        className={fieldCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Manager</label>
                      <select
                        value={managerId}
                        onChange={(e) => setManagerId(e.target.value)}
                        disabled={selectedDepartmentEmployees.length === 0}
                        className={fieldCls}
                      >
                        <option value="">Unassigned</option>
                        {selectedDepartmentEmployees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name}{emp.role ? ` · ${emp.role}` : ""}
                          </option>
                        ))}
                      </select>
                      {selectedDepartmentEmployees.length === 0 && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Add employees to this department before assigning a manager.
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleSaveDepartment}
                      disabled={isSaving || !departmentName.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save size={15} />
                      Save changes
                    </button>
                  </div>
                </div>

                {/* Employees list */}
                <div className="space-y-4 rounded-xl border border-border bg-background p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">Employees</h4>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Only members of this department can be set as manager.
                      </p>
                    </div>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {selectedDepartmentEmployees.length}
                    </span>
                  </div>

                  <div className="max-h-80 space-y-2 overflow-y-auto pr-0.5">
                    {selectedDepartmentEmployees.length > 0 ? (
                      selectedDepartmentEmployees.map((emp) => (
                        <EmployeeTag
                          key={emp.id}
                          employee={emp}
                          isManager={emp.id === selectedDepartment.manager_id}
                        />
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                        No employees assigned to this department yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-border bg-card text-sm text-muted-foreground">
              Select a department to manage it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}