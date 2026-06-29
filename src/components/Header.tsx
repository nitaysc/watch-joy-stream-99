import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Film, Search, Globe } from "lucide-react";
import { useEffect, useState } from "react";
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
  const { t, i18n } = useTranslation();

  useEffect(() => {
    setQ(search.q ?? "");
  }, [search.q]);

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
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <Film className="h-6 w-6 text-primary" />
          <span className="text-lg">{t("Cinely")}</span>
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
            placeholder={t("Search movies & TV...")}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </form>
        <div className="flex items-center gap-1 ml-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-2 px-2 text-muted-foreground hover:text-foreground">
                <Globe className="h-4 w-4" />
                <span className="text-sm font-medium">{currentLanguageLabel()}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[120px]">
              <DropdownMenuItem onClick={() => handleLanguageChange("he")} className={i18n.language === "he" ? "bg-muted" : ""}>
                עברית
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleLanguageChange("en")} className={i18n.language === "en" ? "bg-muted" : ""}>
                English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleLanguageChange("ru")} className={i18n.language === "ru" ? "bg-muted" : ""}>
                Русский
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
