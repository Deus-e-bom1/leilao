import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SlidersHorizontal, Truck, X } from "lucide-react";

import { LotCard } from "@/components/lot-card";
import { LotFilters } from "@/components/lot-filters";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { lots } from "@/data/lots";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arremate Leilões — Leilões online de eletrônicos e mais" },
      {
        name: "description",
        content:
          "Dê lances em tempo real em eletrônicos, veículos e imóveis. Lotes ao vivo com cronômetro e pagamento facilitado.",
      },
      { property: "og:title", content: "Arremate Leilões — Leilões online ao vivo" },
      {
        property: "og:description",
        content:
          "Lotes ao vivo com lances em tempo real, cronômetro e pagamento em até 12x.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [sort, setSort] = useState("relevancia");

  const visibleLots = useMemo(() => {
    const categories = selectedFilters.filter((item) =>
      ["Móveis", "Eletrônicos", "Ferramentas", "Casa e Cozinha"].includes(item),
    );
    const statuses = selectedFilters.filter((item) =>
      ["Ao vivo agora", "Encerrando hoje", "Recém-publicado"].includes(item),
    );

    const filtered = lots.filter((lot) => {
      const categoryMatch = !categories.length || categories.includes(lot.breadcrumb[1] ?? "");
      const statusMatch =
        !statuses.length ||
        (statuses.includes("Ao vivo agora") && lot.live) ||
        (statuses.includes("Encerrando hoje") && lot.badge === "ÚLTIMAS HORAS") ||
        (statuses.includes("Recém-publicado") && lot.badge === "NOVO");
      const priceMatch = !selectedFilters.includes("Até R$ 500") || lot.currentBid <= 500;
      return categoryMatch && statusMatch && priceMatch;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "encerrando") return a.endsInSeconds - b.endsInSeconds;
      if (sort === "maior-lance") return b.currentBid - a.currentBid;
      if (sort === "menor-lance") return a.currentBid - b.currentBid;
      if (sort === "mais-lances") return b.bids - a.bids;
      return 0;
    });
  }, [selectedFilters, sort]);

  const updateFilter = (value: string, checked: boolean) => {
    setSelectedFilters((current) =>
      checked ? [...current, value] : current.filter((item) => item !== value),
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1280px] px-4 py-6">
        <div className="flex items-center gap-3">
          <Truck className="size-6 shrink-0 text-success" />
          <h1 className="text-xl font-extrabold text-primary sm:text-2xl lg:text-3xl">
            Compre e retire em até 2h ou receba na sua casa hoje mesmo
          </h1>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[256px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <LotFilters selected={selectedFilters} onChange={updateFilter} />
          </aside>

          <section>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
              <p className="text-sm text-muted-foreground">
                 {visibleLots.length} leilão{visibleLots.length > 1 ? "ões" : ""} encontrado
                 {visibleLots.length > 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
                 <button
                   type="button"
                   onClick={() => setFiltersOpen(true)}
                   className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold sm:flex-none lg:hidden"
                 >
                   <SlidersHorizontal className="size-4" /> Filtrar
                </button>
                 <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground sm:flex-none">
                   <span className="hidden sm:inline">Ordenar por</span>
                   <select
                     value={sort}
                     onChange={(event) => setSort(event.target.value)}
                     aria-label="Ordenar leilões"
                     className="h-10 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground sm:w-48"
                   >
                     <option value="relevancia">Relevância</option>
                     <option value="encerrando">Encerrando em breve</option>
                     <option value="maior-lance">Maior lance</option>
                     <option value="menor-lance">Menor lance</option>
                     <option value="mais-lances">Mais lances</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
               {visibleLots.map((lot) => (
                <LotCard key={lot.slug} lot={lot} />
              ))}
            </div>

          </section>
        </div>
      </main>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filtros">
          <button
            type="button"
            aria-label="Fechar filtros"
            onClick={() => setFiltersOpen(false)}
            className="absolute inset-0 bg-overlay"
          />
          <aside className="absolute inset-y-0 right-0 w-[78%] max-w-sm overflow-y-auto bg-card px-5 py-4 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-extrabold">Filtros</h2>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Fechar filtros">
                <X className="size-5" />
              </button>
            </div>
            <LotFilters selected={selectedFilters} onChange={updateFilter} />
          </aside>
        </div>
      )}
      <SiteFooter />
    </div>
  );
}
