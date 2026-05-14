"use client";

import React from "react";
import { 
  Book, 
  FileText, 
  Upload, 
  MessageSquare, 
  Send,
  X,
  Link2,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth-context";
interface DocumentRecord {
  id: number;
  filename: string;
  content_type: string | null;
  text_preview: string | null;
}

interface ChatItem {
  role: "assistant" | "user";
  content: string;
  source: string | null;
}

export default function KnowledgeBase() {
  const [documents, setDocuments] = React.useState<DocumentRecord[]>([]);
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatItem[]>([
    { role: "assistant", content: "Hello! I'm your HR AI assistant. You can ask me anything about company policies.", source: null }
  ]);
  const [input, setInput] = React.useState("");
  const [isTyping, setIsTyping] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadDocuments() {
      try {
        const data = await api.get<DocumentRecord[]>("/documents");
        setDocuments(data || []);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch documents:", err);
        setError("Could not load documents.");
      } finally {
        setIsLoading(false);
      }
    }
    loadDocuments();
  }, []);

  const { user } = useAuth();

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.upload("/documents/upload", formData);
      const updatedDocuments = await api.get<DocumentRecord[]>("/documents");
      setDocuments(updatedDocuments || []);
      setError(null);
    } catch (err) {
      console.error("Upload failed:", err);
      setError("Could not upload document.");
    } finally {
      event.target.value = "";
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = { role: "user", content: input, source: null };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await api.post<{ reply: string }>("/ai/chat", { message: input });
      setMessages(prev => [...prev, { role: "assistant", content: response.reply, source: "Backend AI" }]);
    } catch (err) {
      console.error("Chat failed:", err);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Error: AI assistant is currently unavailable. Please check backend connection.",
        source: "System Error"
      }]);
    } finally {
      setIsTyping(false);
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
    <div className="space-y-8 relative pb-20">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Knowledge Base</h2>
          <p className="text-muted-foreground mt-1">Access company policies and internal documentation.</p>
        </div>
        {user?.role === "Administrator" && (
          <>
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium shadow-lg shadow-primary/20">
              <Upload size={18} />
              <span>Upload Policy</span>
            </button>
            <input ref={fileInputRef} type="file" hidden onChange={handleUpload} />
          </>
        )}
      </div>

      {error ? (
        <div className="p-12 text-center border-2 border-dashed border-destructive/20 bg-destructive/5 rounded-3xl">
          <AlertCircle size={32} className="text-destructive mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      ) : documents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc, idx) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="p-6 rounded-3xl border border-border bg-card hover:shadow-xl hover:shadow-primary/5 transition-all group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <FileText size={24} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-1 bg-secondary rounded-lg">{doc.content_type || "document"}</span>
                  {user?.role === "Administrator" && (
                    <button onClick={async (e) => { e.stopPropagation(); try { await api.delete(`/documents/${doc.id}`); const updated = await api.get<DocumentRecord[]>("/documents"); setDocuments(updated || []); } catch (err) { console.error(err); setError("Could not delete document."); } }} className="text-xs text-destructive px-2 py-1 rounded-md border border-destructive/20 hover:bg-destructive/10">Delete</button>
                  )}
                </div>
              </div>
              <h4 className="font-bold mb-1 group-hover:text-primary transition-colors">{doc.filename}</h4>
              <p className="text-xs text-muted-foreground line-clamp-2">{doc.text_preview || "No preview available."}</p>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="p-20 text-center border-2 border-dashed border-border rounded-3xl">
          <FileText size={48} className="text-muted-foreground mx-auto mb-4 opacity-10" />
          <h3 className="text-lg font-bold">No Documents Available</h3>
          <p className="text-sm text-muted-foreground mt-1">Upload policy documents to populate the knowledge base.</p>
        </div>
      )}

      <div className="p-8 rounded-3xl border-2 border-dashed border-border bg-secondary/30 flex flex-col items-center justify-center text-center">
        <div className="p-4 rounded-full bg-background mb-4">
          <Book size={32} className="text-muted-foreground" />
        </div>
        <h4 className="font-bold">Need help finding something?</h4>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Use our AI-powered RAG assistant to get instant answers.
        </p>
        <button 
          onClick={() => setIsChatOpen(true)}
          className="mt-6 px-6 py-2 bg-foreground text-background rounded-xl font-medium hover:opacity-90 transition-all flex items-center gap-2"
        >
          <MessageSquare size={18} />
          <span>Launch AI Assistant</span>
        </button>
      </div>

      <AnimatePresence>
        {isChatOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-card border-l border-border shadow-2xl z-50 flex flex-col"
            >
              <div className="p-6 border-b border-border flex items-center justify-between bg-primary/5">
                <div className="flex items-center gap-3">
                  <MessageSquare size={20} className="text-primary" />
                  <h3 className="font-bold text-sm">HR AI Assistant</h3>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-secondary rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex flex-col max-w-[85%]", m.role === "user" ? "ml-auto items-end" : "mr-auto items-start")}>
                    <div className={cn("p-3 rounded-2xl text-xs leading-relaxed", m.role === "user" ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-secondary rounded-tl-none")}>
                      {m.content}
                    </div>
                    {m.source && (
                      <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 text-[10px] font-bold">
                        <Link2 size={10} />
                        {m.source}
                      </div>
                    )}
                  </div>
                ))}
                {isTyping && <div className="animate-pulse text-[10px] text-muted-foreground ml-2">AI is thinking...</div>}
              </div>

              <div className="p-6 border-t border-border">
                <div className="flex items-center gap-2 p-2 rounded-2xl bg-secondary border border-border">
                  <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask a question..." 
                    className="flex-1 bg-transparent border-none focus:ring-0 text-xs px-2"
                  />
                  <button onClick={handleSend} disabled={isTyping} className="p-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-50">
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
