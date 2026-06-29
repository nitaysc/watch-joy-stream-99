import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Clapperboard, Search, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search as { q?: string } });
  const [q, setQ] = useState(search.q ?? "");
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScroll = useRef(0);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    setQ(search.q ?? "");
  }, [search.q]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 20);
      setHidden(y > 80 && y > lastScroll.current);
      lastScroll.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const currentLanguageLabel = () => {
    switch(i18n.language) {
      case 'he': return 'עברית';
      case 'ru': return 'Русский';
      default: return 'English';
    }
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      } ${
        scrolled
          ? "glass-strong border-b border-border/50 shadow-lg shadow-black/20"
          : "bg-gradient-to-b from-black/80 to-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link to="/" className="group flex items-center gap-2 font-bold tracking-tight">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-red-600 shadow-lg shadow-primary/30 transition-transform duration-300 group-hover:scale-110 group-hover:shadow-primary/50">
            <Clapperboard className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg transition-colors duration-300 group-hover:text-primary">Cinely</span>
        </Link>

        <form
          className="ml-auto flex flex-1 max-w-md items-center gap-2 rounded-2xl bg-white/5 px-4 py-2 ring-1 ring-white/10 transition-all duration-300 focus-within:bg-white/10 focus-within:ring-primary/50 focus-within:shadow-lg focus-within:shadow-primary/10"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) navigate({ to: "/search", search: { q: q.trim() } });
          }}
        >
          <Search className="h-4 w-4 text-muted-foreground transition-colors duration-300 group-focus-within:text-primary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Search movies & TV...")}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </form>

        <div className="flex items-center gap-1 ml-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-2 px-2 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-xl">
                <Globe className="h-4 w-4" />
                <span className="text-sm font-medium">{currentLanguageLabel()}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[120px] rounded-xl border-white/10 bg-black/90 backdrop-blur-xl">
              <DropdownMenuItem onClick={() => handleLanguageChange("he")} className={i18n.language === "he" ? "bg-primary/20 text-primary" : ""}>
                עברית
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleLanguageChange("en")} className={i18n.language === "en" ? "bg-primary/20 text-primary" : ""}>
                English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleLanguageChange("ru")} className={i18n.language === "ru" ? "bg-primary/20 text-primary" : ""}>
                Русский
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
