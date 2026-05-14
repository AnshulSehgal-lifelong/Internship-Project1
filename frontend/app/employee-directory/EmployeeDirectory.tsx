"use client";

import React from "react";
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  Download,
  ChevronLeft,
  ChevronRight,
  Users,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth-context";

interface EmployeeRecord {
  id: number;
  name: string;
  email: string;
  department_id: number | null;
  role: string | null;
  salary: number | null;
  hire_date: string | null;
  is_active: boolean;
}

interface DepartmentRecord {
  id: number;
  name: string;
}

export default function EmployeeDirectory() {
  const [employees, setEmployees] = React.useState<EmployeeRecord[]>([]);
  const [departments, setDepartments] = React.useState<DepartmentRecord[]>([]);
  const [total, setTotal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [form, setForm] = React.useState({ name: "", email: "", department_id: "", role: "", salary: "", hire_date: "" });
  const [isSaving, setIsSaving] = React.useState(false);
  const { user } = useAuth();

  const loadEmployees = React.useCallback(async () => {
    try {
      const [employeeData, departmentData] = await Promise.all([
        api.get<EmployeeRecord[]>("/employees"),
        api.get<DepartmentRecord[]>("/departments"),
      ]);
      setEmployees(employeeData || []);
      setDepartments(departmentData || []);
      setTotal(employeeData?.length || 0);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
      setError("Backend connection failed.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(loadEmployees, 300);
    return () => clearTimeout(timer);
  }, [search, loadEmployees]);

  const filteredEmployees = employees.filter((employee) => {
    const departmentName = departments.find((department) => department.id === employee.department_id)?.name || "";
    const searchable = `${employee.name} ${employee.email} ${employee.role || ""} ${departmentName}`.toLowerCase();
    return searchable.includes(search.toLowerCase());
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await api.post("/employees", {
        name: form.name,
        email: form.email,
        department_id: form.department_id ? Number(form.department_id) : null,
        role: form.role || null,
        salary: form.salary ? Number(form.salary) : null,
        hire_date: form.hire_date || null,
      });
      setForm({ name: "", email: "", department_id: "", role: "", salary: "", hire_date: "" });
      await loadEmployees();
    } catch (err) {
      console.error("Failed to create employee:", err);
      setError("Could not create employee.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (employeeId: number) => {
    try {
      await api.delete(`/employees/${employeeId}`);
      await loadEmployees();
    } catch (err) {
      console.error("Failed to delete employee:", err);
      setError("Could not delete employee.");
    }
  };

  if (isLoading && employees.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Employee Directory</h2>
          <p className="text-muted-foreground mt-1">Manage and view all members of your organization.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg font-medium hover:bg-secondary transition-colors">
            <Download size={18} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {user?.role === "Administrator" && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-3 p-4 rounded-2xl bg-card border border-border">
        <input name="name" value={form.name} onChange={handleChange} required placeholder="Full name" className="md:col-span-2 h-11 px-4 rounded-lg bg-secondary/50 border-none text-sm" />
        <input name="email" value={form.email} onChange={handleChange} required type="email" placeholder="Email" className="h-11 px-4 rounded-lg bg-secondary/50 border-none text-sm" />
        <input name="role" value={form.role} onChange={handleChange} placeholder="Role" className="h-11 px-4 rounded-lg bg-secondary/50 border-none text-sm" />
        <select name="department_id" value={form.department_id} onChange={(event) => setForm({ ...form, department_id: event.target.value })} className="h-11 px-4 rounded-lg bg-secondary/50 border-none text-sm">
          <option value="">Department</option>
          {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
        <button type="submit" disabled={isSaving} className="h-11 px-4 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50">
          {isSaving ? "Saving..." : "Add Employee"}
        </button>
        <input name="salary" value={form.salary} onChange={handleChange} type="number" placeholder="Salary" className="h-11 px-4 rounded-lg bg-secondary/50 border-none text-sm" />
        <input name="hire_date" value={form.hire_date} onChange={handleChange} type="date" className="h-11 px-4 rounded-lg bg-secondary/50 border-none text-sm" />
        </form>
      )}

      <div className="flex flex-col md:flex-row items-center gap-4 p-4 rounded-2xl bg-card border border-border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or role..." 
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary/50 border-none focus:ring-2 focus:ring-primary/20 text-sm transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-secondary transition-colors whitespace-nowrap">
            <Filter size={16} />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-12 text-center border-2 border-dashed border-destructive/20 bg-destructive/5 rounded-3xl">
          <AlertCircle size={32} className="text-destructive mx-auto mb-3" />
          <p className="font-bold">Error Loading Employees</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      ) : filteredEmployees.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Department</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEmployees.map((employee, idx) => (
                  <motion.tr 
                    key={employee.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="hover:bg-secondary/30 transition-colors group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {employee.avatar || employee.name[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{employee.name}</p>
                          <p className="text-xs text-muted-foreground">{employee.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{departments.find((department) => department.id === employee.department_id)?.name || "-"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{employee.role}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                        employee.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                      )}>
                        {employee.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors">
                          <MoreHorizontal size={18} />
                        </button>
                        {user?.role === "Administrator" && (
                          <button onClick={() => handleDelete(employee.id)} className="px-3 py-2 text-xs font-medium rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10 transition-colors">
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Showing {filteredEmployees.length} of {total} employees</p>
            <div className="flex items-center gap-2">
              <button className="p-2 border border-border rounded-lg disabled:opacity-50" disabled>
                <ChevronLeft size={18} />
              </button>
              <button className="px-3 py-1.5 border border-primary bg-primary/10 text-primary rounded-lg text-sm font-medium">1</button>
              <button className="p-2 border border-border rounded-lg hover:bg-secondary">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-20 text-center border-2 border-dashed border-border rounded-3xl">
          <Users size={48} className="text-muted-foreground mx-auto mb-4 opacity-20" />
          <h3 className="text-lg font-bold">No Employees Found</h3>
          <p className="text-sm text-muted-foreground mt-1">Start by adding your first employee to the directory.</p>
        </div>
      )}
    </div>
  );
}
