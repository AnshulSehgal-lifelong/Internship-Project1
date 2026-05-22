"use client";

import React from "react";
import {
  AlertCircle,
  Briefcase,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  DollarSign,
  Lock,
  Mail,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { motion } from "framer-motion";

export interface DepartmentRecord {
  id: number;
  name: string;
}

export interface AddEmployeeForm {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  department_id: string;
  role: string;
  salary: string;
  hire_date: string;
}

export const ROLES = ["Manager", "Employee", "Intern"];

export const EMPTY_EMPLOYEE_FORM: AddEmployeeForm = {
  first_name: "",
  last_name: "",
  email: "",
  password: "",
  department_id: "",
  role: "",
  salary: "",
  hire_date: "",
};

const inputCls =
  "w-full h-10 px-3 rounded-lg bg-secondary/60 border border-border text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all";

interface FormFieldProps {
  label: string;
  icon: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}

function FormField({ label, icon, required, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
        {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function SelectField({
  name,
  value,
  onChange,
  placeholder,
  children,
}: {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        name={name}
        value={value}
        onChange={onChange}
        className={`${inputCls} appearance-none pr-8`}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

interface AddEmployeePanelProps {
  form: AddEmployeeForm;
  departments: DepartmentRecord[];
  isSaving: boolean;
  saveSuccess: boolean;
  formError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
}

export default function AddEmployeePanel({
  form,
  departments,
  isSaving,
  saveSuccess,
  formError,
  onChange,
  onSubmit,
  onClose,
  title = "Add employee",
  subtitle = "Create a new employee account",
  submitLabel = "Add employee",
}: AddEmployeePanelProps) {
  return (
    <>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />

      <motion.div
        key="panel"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <UserPlus size={17} className="text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold">{title}</h3>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {formError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm text-destructive">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="First name" icon={<User size={11} />} required>
              <input name="first_name" value={form.first_name} onChange={onChange} required placeholder="John" className={inputCls} />
            </FormField>
            <FormField label="Last name" icon={<User size={11} />} required>
              <input name="last_name" value={form.last_name} onChange={onChange} required placeholder="Doe" className={inputCls} />
            </FormField>
          </div>

          <FormField label="Email address" icon={<Mail size={11} />} required>
            <input name="email" value={form.email} onChange={onChange} required type="email" placeholder="john.doe@company.com" className={inputCls} />
          </FormField>

          <FormField label="Password" icon={<Lock size={11} />} required>
            <input name="password" value={form.password} onChange={onChange} required type="password" placeholder="Set a secure password" className={inputCls} />
          </FormField>

          <div className="border-t border-border/60 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Employment details
            </p>
            <div className="space-y-4">
              <FormField label="Role" icon={<Briefcase size={11} />}>
                <SelectField name="role" value={form.role} onChange={onChange} placeholder="Select a role…">
                  {ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </SelectField>
              </FormField>

              <FormField label="Department" icon={<Building2 size={11} />}>
                <SelectField name="department_id" value={form.department_id} onChange={onChange} placeholder="Select a department…">
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </SelectField>
              </FormField>

              <FormField label="Salary (₹)" icon={<DollarSign size={11} />}>
                <input name="salary" value={form.salary} onChange={onChange} type="number" min="0" step="1000" placeholder="e.g. 600000" className={inputCls} />
              </FormField>

              <FormField label="Hire date" icon={<Calendar size={11} />}>
                <input name="hire_date" value={form.hire_date} onChange={onChange} type="date" className={inputCls} />
              </FormField>
            </div>
          </div>
        </form>

        <div className="flex shrink-0 gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-border text-sm font-medium transition-colors hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isSaving || saveSuccess}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:opacity-90 disabled:opacity-60"
          >
            {saveSuccess ? (
              <><Check size={15} /> Added!</>
            ) : isSaving ? (
              <><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" /> Saving…</>
            ) : (
              <><UserPlus size={15} /> {submitLabel}</>
            )}
          </button>
        </div>
      </motion.div>
    </>
  );
}
