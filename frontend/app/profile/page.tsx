"use client";

import React from "react";
import { useAuth } from "@/components/auth-context";

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) return <div className="p-8">No profile available.</div>;

  return (
    <div className="p-8 space-y-4">
      <h2 className="text-2xl font-bold">My Profile</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Name</p>
          <p className="font-medium">{user.first_name} {user.last_name}</p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Email</p>
          <p className="font-medium">{user.email}</p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Role</p>
          <p className="font-medium">{user.role}</p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Status</p>
          <p className="font-medium">{user.is_active ? "Active" : "Inactive"}</p>
        </div>
      </div>
    </div>
  );
}
