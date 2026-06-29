import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Header } from "@/components/Header";
import { I18nextProvider, useTranslation } from "react-i18next";
import i18n from "../lib/i18n";

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("Page not found.")}</p>
        <a href="/" className="mt-6 inline-block rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{t("Go home")}</a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const { t } = useTranslation();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">{t("Something went wrong")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {t("Try again")}
          </button>
          <a href="/" className="rounded-full border border-border px-4 py-2 text-sm">{t("Home")}</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Cinely — Watch Movies & TV Free" },
      { name: "description", content: "Stream the latest movies and TV series for free in HD. Discover trending titles powered by TMDB." },
      { property: "og:title", content: "Cinely — Watch Movies & TV Free" },
      { property: "og:description", content: "Stream the latest movies and TV series for free in HD. Discover trending titles powered by TMDB." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Cinely — Watch Movies & TV Free" },
      { name: "twitter:description", content: "Stream the latest movies and TV series for free in HD. Discover trending titles powered by TMDB." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/45a1229e-a5ec-4b23-a947-710a831aa3ed/id-preview-5f302034--7f0db553-144c-4cd4-9b35-35220810cb5c.lovable.app-1782745971097.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/45a1229e-a5ec-4b23-a947-710a831aa3ed/id-preview-5f302034--7f0db553-144c-4cd4-9b35-35220810cb5c.lovable.app-1782745971097.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === "he";
  return (
    <html lang={i18n.language} dir={isRtl ? "rtl" : "ltr"}>
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen">
          <Header />
          <Outlet />
        </div>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
