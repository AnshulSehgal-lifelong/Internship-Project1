"use client";

import React from "react";
import { Search, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

export default function Header() {
  const [query, setQuery] = React.useState("");
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  const toggleDarkMode = () => {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuery = query.trim();

    if (trimmedQuery) {
      router.push(`/employee-directory?search=${encodeURIComponent(trimmedQuery)}`);
    }
  };

  return (
    <header className="h-16 border-b border-border bg-background/50 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-40">
      <div className="flex-1 max-w-xl">
        <form className="relative group" onSubmit={handleSearch}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" size={18} />
          <input 
            type="text" 
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search employees..." 
            className="w-full h-10 pl-10 pr-4 rounded-full bg-secondary border-none focus:ring-2 focus:ring-primary/20 text-sm transition-all"
          />
        </form>
      </div>

      <button 
        onClick={toggleDarkMode}
        className="ml-8 p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
      >
        {resolvedTheme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    </header>
  );
}
