import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { searchMedia } from "@/lib/tmdb.functions";
import { MediaCard } from "@/components/MediaCard";

const searchSchema = z.object({ q: z.string().optional().default("") });

const buildQuery = (q: string) =>
  queryOptions({
    queryKey: ["search", q],
    queryFn: () => searchMedia({ data: { q } }),
    enabled: q.length > 0,
  });

export const Route = createFileRoute("/search")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ context, deps }) => {
    if (deps.q) return context.queryClient.ensureQueryData(buildQuery(deps.q));
  },
  head: ({ loaderData: _ld, params: _p }) => ({
    meta: [{ title: "Search — Cinely" }, { name: "description", content: "Search movies and TV series." }],
  }),
  component: SearchPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const { data } = useSuspenseQuery({ ...buildQuery(q), initialData: q ? undefined : { results: [] } });

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">
        {q ? <>Results for <span className="text-primary">"{q}"</span></> : "Search"}
      </h1>
      {q && data.results.length === 0 && (
        <p className="text-muted-foreground">No results found.</p>
      )}
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {data.results.map((it) => (
          <div key={`${it.type}-${it.id}`} className="flex justify-center">
            <MediaCard item={it} />
          </div>
        ))}
      </div>
    </main>
  );
}
