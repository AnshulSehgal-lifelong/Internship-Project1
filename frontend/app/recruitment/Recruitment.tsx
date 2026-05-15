"use client";

import React from "react";
import { 
  FileText, 
  User,
  ChevronRight,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";

interface JobOpeningRecord {
  id: number;
  title: string;
  description: string;
  requirements: string;
}

export default function Recruitment() {
  const [openings, setOpenings] = React.useState<JobOpeningRecord[]>([]);
  const [selectedOpening, setSelectedOpening] = React.useState<JobOpeningRecord | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ title: "", description: "", requirements: "" });

  React.useEffect(() => {
    async function loadOpenings() {
      try {
        const data = await api.get<JobOpeningRecord[]>('/job-openings');
        setOpenings(data || []);
        if (data && data.length > 0) setSelectedOpening(data[0]);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch openings:", err);
        setError("Could not load recruitment data.");
      } finally {
        setIsLoading(false);
      }
    }
    loadOpenings();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await api.post('/job-openings', form);
      setForm({ title: "", description: "", requirements: "" });
      const data = await api.get<JobOpeningRecord[]>('/job-openings');
      setOpenings(data || []);
      if (data && data.length > 0) setSelectedOpening(data[0]);
    } catch (err) {
      console.error("Create opening failed:", err);
      alert("Failed to create the opening. Please ensure backend is running.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (openingId: number) => {
    try {
      await api.delete(`/job-openings/${openingId}`);
      const data = await api.get<JobOpeningRecord[]>('/job-openings');
      setOpenings(data || []);
      setSelectedOpening(data?.[0] || null);
    } catch (err) {
      console.error("Delete opening failed:", err);
      alert("Failed to delete the opening.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Recruitment AI</h2>
        <p className="text-muted-foreground mt-1">AI-powered job opening tracking connected to the backend.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <form onSubmit={handleSubmit} className="p-6 border-2 border-dashed border-primary/20 bg-primary/5 rounded-3xl space-y-4">
            <h4 className="text-lg font-bold">Create Opening</h4>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="w-full h-11 px-4 rounded-xl bg-background border border-border" />
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="w-full min-h-28 p-4 rounded-xl bg-background border border-border" />
            <textarea value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} placeholder="Requirements" className="w-full min-h-24 p-4 rounded-xl bg-background border border-border" />
            <button type="submit" disabled={isSaving} className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-bold disabled:opacity-50">
              {isSaving ? "Saving..." : "Save Opening"}
            </button>
          </form>

          <div className="flex-1 border border-border bg-card rounded-3xl overflow-auto flex flex-col min-h-75">
            <div className="p-4 border-b border-border">
              <h3 className="font-bold">Open Positions ({openings.length})</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {error ? (
                <div className="p-12 text-center text-destructive">
                  <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              ) : openings.length > 0 ? (
                openings.map((opening) => (
                  <button
                    key={opening.id}
                    onClick={() => setSelectedOpening(opening)}
                    className={cn(
                      "w-full p-4 flex items-center gap-4 text-left transition-all border-b border-border/50 last:border-0",
                      selectedOpening?.id === opening.id ? "bg-primary/5 border-l-4 border-l-primary" : "hover:bg-secondary/30"
                    )}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center font-bold text-sm">
                      {opening.title[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-sm truncate">{opening.title}</p>
                        <span className="text-[10px] text-muted-foreground">#{opening.id}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{opening.requirements?.slice(0, 80)}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-12 text-center">
                  <FileText size={32} className="text-muted-foreground mb-2 opacity-20" />
                  <p className="text-muted-foreground text-sm">No openings tracked yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 h-full">
          <AnimatePresence mode="wait">
            {selectedOpening ? (
              <motion.div
                key={selectedOpening.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="h-full border border-border bg-card rounded-3xl overflow-auto flex flex-col shadow-2xl shadow-primary/5"
              >
                <div className="p-6 bg-primary/5 border-b border-border">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl font-bold">
                      {selectedOpening.title[0]}
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">{selectedOpening.title}</h4>
                      <p className="text-sm text-muted-foreground">Job Opening</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-6 text-sm">
                  <div>
                    <h5 className="font-bold uppercase tracking-wider text-muted-foreground mb-3 text-[10px]">Description</h5>
                    <p className="text-muted-foreground">{selectedOpening.description}</p>
                  </div>
                  <div>
                    <h5 className="font-bold uppercase tracking-wider text-muted-foreground mb-3 text-[10px]">Requirements</h5>
                    <p className="text-muted-foreground">{selectedOpening.requirements}</p>
                  </div>
                </div>

                <div className="p-6 border-t border-border grid grid-cols-2 gap-3">
                  <button onClick={() => handleDelete(selectedOpening.id)} className="px-4 py-2 border border-border rounded-xl text-sm font-bold">Delete</button>
                  <button className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold">Review</button>
                </div>
              </motion.div>
            ) : (
              <div className="h-full border border-border border-dashed rounded-3xl flex flex-col items-center justify-center text-center p-8">
                <User size={32} className="text-muted-foreground mb-4 opacity-10" />
                <p className="text-sm text-muted-foreground">Select a job opening to view details.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
