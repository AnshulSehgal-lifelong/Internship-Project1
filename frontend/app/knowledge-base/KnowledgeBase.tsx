"use client";

import React from "react";
import {
  AlertCircle,
  Book,
  FileText,
  Link2,
  MessageSquare,
  Send,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL, api } from "@/lib/api";
import { useAuth } from "@/components/auth-context";
import FilePreviewModal from "@/components/FilePreviewModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocumentRecord {
  id: string;
  original_name: string;
  mime_type: string;
  status: string;
  document_type: "policy" | "resume";
}

interface ChatItem {
  id: string;
  role: "assistant" | "user";
  content: string;
  source: string | null;
}

type AssistantBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: "bulletList"; items: string[] }
  | { type: "orderedList"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "separator" }
  | { type: "code"; text: string };

function renderInlineText(text: string) {
  const parts: React.ReactNode[] = [];
  const boldPattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    parts.push(
      <strong key={match.index} className="font-semibold text-foreground">
        {match[1]}
      </strong>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function parseAssistantBlocks(content: string): AssistantBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: AssistantBlock[] = [];
  const paragraphLines: string[] = [];
  const bulletItems: string[] = [];
  const orderedItems: string[] = [];
  const codeLines: string[] = [];
  let inCodeBlock = false;
  let listType: "bullet" | "ordered" | null = null;

  const flushParagraph = () => {
    const text = paragraphLines.join(" ").trim();
    if (text) {
      blocks.push({ type: "paragraph", text });
    }
    paragraphLines.length = 0;
  };

  const flushList = () => {
    if (listType === "bullet" && bulletItems.length > 0) {
      blocks.push({ type: "bulletList", items: [...bulletItems] });
    }
    if (listType === "ordered" && orderedItems.length > 0) {
      blocks.push({ type: "orderedList", items: [...orderedItems] });
    }
    bulletItems.length = 0;
    orderedItems.length = 0;
    listType = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (inCodeBlock) {
      if (line.startsWith("```")) {
        blocks.push({ type: "code", text: codeLines.join("\n") });
        codeLines.length = 0;
        inCodeBlock = false;
      } else {
        codeLines.push(rawLine);
      }
      continue;
    }

    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      inCodeBlock = true;
      continue;
    }

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line === "***" || line === "---") {
      flushParagraph();
      flushList();
      blocks.push({ type: "separator" });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        text: headingMatch[2],
      });
      continue;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      if (listType && listType !== "bullet") {
        flushList();
      }
      listType = "bullet";
      bulletItems.push(bulletMatch[1]);
      continue;
    }

    const orderedMatch = line.match(/^\d+[.)]\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== "ordered") {
        flushList();
      }
      listType = "ordered";
      orderedItems.push(orderedMatch[1]);
      continue;
    }

    const quoteMatch = line.match(/^>\s+(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      blocks.push({ type: "quote", text: quoteMatch[1] });
      continue;
    }

    paragraphLines.push(line);
  }

  if (inCodeBlock && codeLines.length > 0) {
    blocks.push({ type: "code", text: codeLines.join("\n") });
  }

  flushParagraph();
  flushList();

  return blocks;
}

function renderAssistantContent(content: string) {
  const blocks = parseAssistantBlocks(content);

  if (blocks.length === 0) {
    return <p className="whitespace-pre-wrap wrap-break-word">{content}</p>;
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <div
              key={index}
              className={cn(
                "font-semibold text-foreground",
                block.level === 1 && "text-base md:text-lg",
                block.level === 2 && "text-sm",
                block.level === 3 && "text-[13px] uppercase tracking-wide text-primary",
                block.level === 4 && "text-xs",
                block.level === 5 && "text-[11px] italic text-muted-foreground",
                block.level === 6 && "text-[10px] uppercase tracking-wide text-muted-foreground",
              )}
            >
              {renderInlineText(block.text)}
            </div>
          );
        }

        if (block.type === "bulletList") {
          return (
            <ul key={index} className="space-y-1 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="list-disc whitespace-pre-wrap wrap-break-word">
                  {renderInlineText(item)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "orderedList") {
          return (
            <ol key={index} className="space-y-1 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="list-decimal whitespace-pre-wrap wrap-break-word">
                  {renderInlineText(item)}
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "quote") {
          return (
            <div
              key={index}
              className="border-l-2 border-primary/30 pl-3 text-muted-foreground italic"
            >
              {renderInlineText(block.text)}
            </div>
          );
        }

        if (block.type === "separator") {
          return <hr key={index} className="my-3 border-border/80" />;
        }

        if (block.type === "code") {
          return (
            <pre
              key={index}
              className="overflow-x-auto rounded-xl bg-slate-950 px-3 py-2 text-[11px] leading-relaxed text-slate-100"
            >
              <code>{block.text}</code>
            </pre>
          );
        }

        return (
          <p key={index} className="whitespace-pre-wrap wrap-break-word">
            {renderInlineText(block.text)}
          </p>
        );
      })}
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_MESSAGES: ChatItem[] = [
  {
    id: "welcome-message",
    role: "assistant",
    content: "Hello! I'm your HR AI assistant. Ask me anything about company policies.",
    source: null,
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function DocumentCard({
  doc,
  canManage,
  onPreview,
  onDelete,
}: {
  doc: DocumentRecord;
  canManage: boolean;
  onPreview: (doc: DocumentRecord) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileText size={20} />
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {doc.mime_type || "doc"}
          </span>
        </div>
      </div>

      <div>
        <p className="truncate font-semibold text-sm transition-colors group-hover:text-primary">
          {doc.original_name}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Status:{" "}
          <span
            className={cn(
              "font-medium",
              doc.status === "ready" ? "text-emerald-500" : "text-amber-500"
            )}
          >
            {doc.status}
          </span>
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        <button
          onClick={() => onPreview(doc)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80"
        >
          Preview
        </button>
        {canManage && (
          <button
            onClick={() => onDelete(doc.id)}
            className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function ChatBubble({ message }: { message: ChatItem }) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex max-w-[85%] flex-col gap-2",
        isUser ? "ml-auto items-end" : "mr-auto items-start"
      )}
    >
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 text-xs leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-secondary text-foreground"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>
        ) : (
          renderAssistantContent(message.content)
        )}
      </div>
      {message.source && (
        <div className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-600">
          <Link2 size={9} />
          {message.source}
        </div>
      )}
    </div>
  );
}

function ChatPanel({
  messages,
  input,
  isTyping,
  onInputChange,
  onSend,
  onStop,
  onClose,
}: {
  messages: ChatItem[];
  input: string;
  isTyping: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onClose: () => void;
}) {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
      />

      {/* Panel */}
      <motion.div
        key="panel"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-primary/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MessageSquare size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold">HR AI Assistant</p>
              <p className="text-xs text-muted-foreground">Powered by your policy documents</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.map((m, i) => (
            <ChatBubble key={m.id ?? i} message={m} />
          ))}
          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    animate={{ y: [0, -5, 0] }}
                    transition={{
                      duration: 0.9,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                      delay: d * 0.12,
                    }}
                    className="h-2 w-2 rounded-full bg-primary/70"
                  />
                ))}
              </span>
              Generating response…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-border p-4">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2">
            <input
              type="text"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isTyping && onSend()}
              placeholder="Ask a question…"
              className="flex-1 bg-transparent text-xs focus:outline-none"
            />
            {isTyping ? (
              <button
                onClick={onStop}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive text-destructive-foreground transition-opacity hover:opacity-90"
                aria-label="Stop generation"
                title="Stop generation"
              >
                <Square size={12} />
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={!input.trim()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                aria-label="Send message"
                title="Send message"
              >
                <Send size={13} />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function KnowledgeBase() {
  const { user } = useAuth();

  const [documents, setDocuments] = React.useState<DocumentRecord[]>([]);
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatItem[]>(INITIAL_MESSAGES);
  const [input, setInput] = React.useState("");
  const [isTyping, setIsTyping] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = React.useState<DocumentRecord | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const activeChatRequestRef = React.useRef<AbortController | null>(null);
  const previewUrlRef = React.useRef<string | null>(null);

  // ─── Permissions ────────────────────────────────────────────────────────

  const canManagePolicies = React.useMemo(() => {
    const role = user?.role ?? "";
    const dept = user?.department_name?.trim().toLowerCase() ?? "";
    const isAdmin = role === "Administrator";
    const isHrUser = role === "HR";
    const isHrManager = role === "Manager" && ["hr", "human resources"].includes(dept);
    return isAdmin || isHrUser || isHrManager;
  }, [user]);

  // ─── Data fetching ───────────────────────────────────────────────────────

  const loadDocuments = React.useCallback(async () => {
    const data = await api.get<DocumentRecord[]>("/documents?document_type=policy");
    return data ?? [];
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const data = await loadDocuments();
        if (!isMounted) {
          return;
        }

        setDocuments(data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch documents:", err);
        if (isMounted) {
          setError("Could not load documents.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [loadDocuments]);

  React.useEffect(() => {
    return () => {
      activeChatRequestRef.current?.abort();
    };
  }, []);

  const closePreview = React.useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setPreviewError(null);
    setIsPreviewLoading(false);
    setIsPreviewOpen(false);
    setPreviewDoc(null);
  }, []);

  const openPreview = React.useCallback(async (doc: DocumentRecord) => {
    setPreviewDoc(doc);
    setIsPreviewOpen(true);
    setPreviewError(null);
    setIsPreviewLoading(true);
    try {
      const blob = await api.fetchBlob(`/documents/${doc.id}/preview`);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      previewUrlRef.current = URL.createObjectURL(blob);
      setPreviewUrl(previewUrlRef.current);
    } catch (err) {
      console.error("Failed to load document preview:", err);
      setPreviewError("Preview unavailable for this file.");
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreviewUrl(null);
    } finally {
      setIsPreviewLoading(false);
    }
  }, []);

  React.useEffect(() => () => closePreview(), [closePreview]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", "policy");
      await api.upload("/documents/upload", formData);
      const data = await loadDocuments();
      setDocuments(data);
      setError(null);
    } catch (err) {
      console.error("Upload failed:", err);
      setError("Could not upload document.");
    } finally {
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/documents/${id}`);
      const data = await loadDocuments();
      setDocuments(data);
      setError(null);
    } catch (err) {
      console.error("Delete failed:", err);
      setError("Could not delete document.");
    }
  };

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt || isTyping) return;

    const userMessage: ChatItem = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      source: null,
    };
    const assistantMessageId = crypto.randomUUID();
    const history = [...messages, userMessage]
      .filter((message) => message.content.trim())
      .map(({ role, content }) => ({ role, content }));

    activeChatRequestRef.current?.abort();
    const controller = new AbortController();
    activeChatRequestRef.current = controller;

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        source: null,
      },
    ]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE_URL}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: prompt, messages: history }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || `API error: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) {
          continue;
        }

        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: message.content + chunk,
                }
              : message,
          ),
        );
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                source: "Hr AI Assistant",
              }
            : message,
        ),
      );
    } catch (err) {
      if ((err as DOMException | null)?.name === "AbortError") {
        return;
      }

      console.error("Chat failed:", err);
      setMessages((prev) => [
        ...prev.filter((message) => message.id !== assistantMessageId),
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "AI assistant is currently unavailable. Please check the backend connection.",
          source: "System",
        },
      ]);
    } finally {
      if (activeChatRequestRef.current === controller) {
        activeChatRequestRef.current = null;
      }
      setIsTyping(false);
    }
  };

  const handleStop = React.useCallback(() => {
    activeChatRequestRef.current?.abort();
  }, []);

  // ─── Loading state ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-8">
        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <h2 className="text-3xl font-bold tracking-tight">Knowledge base</h2>
            <p className="text-sm text-muted-foreground">
              Access company policies and internal documentation.
            </p>
          </div>

          {canManagePolicies && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-opacity hover:opacity-90 active:scale-95"
              >
                <Upload size={16} />
                Upload policy
              </button>
              <input ref={fileInputRef} type="file" hidden onChange={handleUpload} />
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Documents grid */}
        {documents.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                canManage={canManagePolicies}
                onPreview={openPreview}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-16 text-center">
            <FileText size={36} className="mb-4 text-muted-foreground opacity-20" />
            <h3 className="font-semibold">No documents yet</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Upload policy documents to populate the knowledge base.
            </p>
          </div>
        )}

        {/* AI assistant CTA */}
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-secondary/20 px-6 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card shadow-sm">
            <Book size={22} className="text-muted-foreground" />
          </div>
          <div>
            <h4 className="font-semibold">Need help finding something?</h4>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Use our AI-powered assistant to get instant answers from your policy documents.
            </p>
          </div>
          <button
            onClick={() => setIsChatOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-80"
          >
            <MessageSquare size={15} />
            Launch AI assistant
          </button>
        </div>
      </div>

      {/* Preview modal */}
      {isPreviewOpen && previewDoc && (
        <FilePreviewModal
          title="Document preview"
          fileName={previewDoc.original_name}
          previewUrl={previewUrl}
          isLoading={isPreviewLoading}
          error={previewError}
          onClose={closePreview}
        />
      )}

      {/* Chat panel */}
      <AnimatePresence>
        {isChatOpen && (
          <ChatPanel
            messages={messages}
            input={input}
            isTyping={isTyping}
            onInputChange={setInput}
            onSend={handleSend}
            onStop={handleStop}
            onClose={() => setIsChatOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}