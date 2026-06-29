import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Film, Search } from "lucide-react";
import { useEffect, useState } from "react";

export function Header() {
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search as { q?: string } });
  const [q, setQ] = useState(search.q ?? "");

  useEffect(() => {
    setQ(search.q ?? "");
  }, [search.q]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <Film className="h-6 w-6 text-primary" />
          <span className="text-lg">Cinely</span>
        </Link>
        <form
          className="ml-auto flex flex-1 max-w-md items-center gap-2 rounded-full bg-card/80 px-4 py-2 ring-1 ring-border focus-within:ring-primary"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) navigate({ to: "/search", search: { q: q.trim() } });
          }}
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search movies & TV…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </form>
      </div>
    </header>
  );
}
