"use client";

import React from "react";
import { FileText, X } from "lucide-react";

type FilePreviewModalProps = {
  title: string;
  fileName: string;
  previewUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
};

export default function FilePreviewModal({
  title,
  fileName,
  previewUrl,
  isLoading,
  error,
  onClose,
}: FilePreviewModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-5xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {title}
              </p>
              <p className="text-sm font-semibold">{fileName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden bg-secondary/20 p-5">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center gap-2.5 text-sm text-muted-foreground">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading preview…
            </div>
          ) : previewUrl ? (
            <iframe
              title={title}
              src={previewUrl}
              className="h-full min-h-[75vh] w-full rounded-xl border border-border bg-background"
            />
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
              <FileText size={24} className="text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">
                {error ?? "Preview unavailable for this file type."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}