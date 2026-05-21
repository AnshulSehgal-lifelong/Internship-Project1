"use client";

import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Plus,
  UserCheck,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth-context";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DepartmentMember {
  id: number;
  name: string;
  role: string | null;
  email: string;
  is_active: boolean;
}

interface DepartmentOverview {
  id: number;
  name: string;
  manager: { id: number; name: string; role: string | null; email: string } | null;
  members: DepartmentMember[];
}

interface TaskRecord {
  id: number;
  title: string;
  description: string | null;
  status: "assigned" | "completed";
  department_id: number;
  assigned_by: number;
  assigned_to: number;
  created_at: string;
  completed_at: string | null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TaskStatusBadge({ status }: { status: "assigned" | "completed" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "completed"
          ? "bg-emerald-500/10 text-emerald-600"
          : "bg-amber-500/10 text-amber-600"
      )}
    >
      {status === "completed" ? "Completed" : "Assigned"}
    </span>
  );
}

function MyTaskCard({
  task,
  assignerName,
  onComplete,
}: {
  task: TaskRecord;
  assignerName: string;
  onComplete: (id: number) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-secondary/20 p-4 transition-colors hover:bg-secondary/40">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{task.title}</p>
        {task.description && (
          <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          From <span className="font-medium text-foreground">{assignerName}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2.5">
        <TaskStatusBadge status={task.status} />
        {task.status !== "completed" && (
          <button
            onClick={() => onComplete(task.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            <CheckCircle2 size={13} />
            Mark done
          </button>
        )}
      </div>
    </div>
  );
}

function DeptTaskCard({
  task,
  assigneeName,
}: {
  task: TaskRecord;
  assigneeName: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-secondary/20 p-4 transition-colors hover:bg-secondary/40">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{task.title}</p>
        {task.description && (
          <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Assigned to <span className="font-medium text-foreground">{assigneeName}</span>
        </p>
      </div>
      <TaskStatusBadge status={task.status} />
    </div>
  );
}

function EmptyTasksPlaceholder({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Tasks() {
  const { user } = useAuth();

  const [department, setDepartment] = React.useState<DepartmentOverview | null>(null);
  const [myTasks, setMyTasks] = React.useState<TaskRecord[]>([]);
  const [deptTasks, setDeptTasks] = React.useState<TaskRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Form state
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState("");

  // ─── Derived ────────────────────────────────────────────────────────────

  const isManager = Boolean(user && department?.manager?.id === user.id);

  const nameById = React.useMemo(() => {
    const map = new Map<number, string>();
    department?.members.forEach((m) => map.set(m.id, m.name));
    if (department?.manager) map.set(department.manager.id, department.manager.name);
    return map;
  }, [department]);

  // ─── Data fetching ───────────────────────────────────────────────────────

  const loadTasks = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [deptData, myTaskData] = await Promise.all([
        api.get<DepartmentOverview>("/departments/my").catch(() => null),
        api.get<TaskRecord[]>("/tasks/my"),
      ]);

      setDepartment(deptData);
      setMyTasks(myTaskData ?? []);

      if (deptData?.manager?.id === user?.id) {
        const deptTaskData = await api.get<TaskRecord[]>("/tasks/department");
        setDeptTasks(deptTaskData ?? []);
      } else {
        setDeptTasks([]);
      }

      setError(null);
    } catch (err) {
      console.error("Failed to load tasks:", err);
      setError("Could not load tasks.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  React.useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleAssign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !assigneeId) return;

    setIsSaving(true);
    try {
      await api.post("/tasks", {
        title: title.trim(),
        description: description.trim() || null,
        assigned_to: Number(assigneeId),
      });
      setTitle("");
      setDescription("");
      setAssigneeId("");
      await loadTasks();
    } catch (err) {
      console.error("Failed to assign task:", err);
      setError("Could not assign task.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async (taskId: number) => {
    try {
      await api.patch(`/tasks/${taskId}/complete`, {});
      await loadTasks();
    } catch (err) {
      console.error("Failed to complete task:", err);
      setError("Could not mark task as completed.");
    }
  };

  // ─── Loading state ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // ─── Field style ─────────────────────────────────────────────────────────

  const fieldCls =
    "h-10 w-full rounded-xl border border-border bg-secondary/40 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all";

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Tasks</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Track assignments from your manager and mark them complete.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Assign task form — manager only */}
      {isManager && department && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users size={18} />
            </div>
            <div>
              <h3 className="font-semibold">Assign a task</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Send a task to a member of {department.name}.
              </p>
            </div>
          </div>

          <form onSubmit={handleAssign} className="grid gap-3 sm:grid-cols-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              required
              className={fieldCls}
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details (optional)"
              className={fieldCls}
            />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  required
                  className={fieldCls}
                >
                  <option value="">Assign to…</option>
                  {department.members.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={isSaving || !title.trim() || !assigneeId}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Plus size={15} />
                {isSaving ? "Saving…" : "Assign"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Task columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* My tasks */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ClipboardList size={17} />
              </div>
              <div>
                <h3 className="font-semibold">My tasks</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Assigned to you</p>
              </div>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {myTasks.length}
            </span>
          </div>

          <div className="space-y-3 p-5">
            {myTasks.length === 0 ? (
              <EmptyTasksPlaceholder message="No tasks assigned yet." />
            ) : (
              myTasks.map((task) => (
                <MyTaskCard
                  key={task.id}
                  task={task}
                  assignerName={nameById.get(task.assigned_by) ?? "Manager"}
                  onComplete={handleComplete}
                />
              ))
            )}
          </div>
        </div>

        {/* Department tasks */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserCheck size={17} />
              </div>
              <div>
                <h3 className="font-semibold">Department tasks</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isManager ? "Tasks across your team" : "Visible to managers only"}
                </p>
              </div>
            </div>
            {isManager && (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {deptTasks.length}
              </span>
            )}
          </div>

          <div className="space-y-3 p-5">
            {!isManager ? (
              <EmptyTasksPlaceholder message="Only managers can view all department tasks." />
            ) : deptTasks.length === 0 ? (
              <EmptyTasksPlaceholder message="No department tasks yet." />
            ) : (
              deptTasks.map((task) => (
                <DeptTaskCard
                  key={task.id}
                  task={task}
                  assigneeName={nameById.get(task.assigned_to) ?? "Team member"}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}