import { Link } from "@tanstack/react-router";
import { Gavel, Heart } from "lucide-react";

import { Countdown } from "@/components/countdown";
import { brl, type Lot } from "@/data/lots";

export function LotCard({ lot }: { lot: Lot }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow duration-200 hover:shadow-md">
      <button
        aria-label="Favoritar lote"
        className="absolute right-3 top-3 z-20 grid size-8 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
      >
        <Heart className="size-4" />
      </button>

      <Link
        to="/lote/$slug"
        params={{ slug: lot.slug }}
        aria-label={`Abrir ${lot.title}`}
        className="flex flex-1 flex-col"
      >
        <div className="relative border-b border-border p-3">
          {lot.badge ? (
            <span
              className={`absolute left-3 top-3 z-10 rounded-md px-2 py-1 text-[11px] font-bold tracking-wide ${
                lot.badgeTone === "new"
                  ? "bg-primary text-primary-foreground"
                  : "bg-urgent text-urgent-foreground"
              }`}
            >
              {lot.badge}
            </span>
          ) : (
            lot.live && (
              <span className="absolute left-3 top-3 z-10 rounded-md bg-live px-2 py-1 text-[11px] font-bold tracking-wide text-live-foreground">
                AO VIVO
              </span>
            )
          )}
          <img
            src={lot.images[0]!.url}
            alt={lot.images[0]!.alt}
            loading="lazy"
            className="mx-auto aspect-square w-full max-w-[220px] object-contain transition-transform duration-200 group-hover:scale-[1.03]"
          />
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-snug text-foreground sm:min-h-[2.75rem] sm:text-base">
            {lot.title}
          </h3>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Gavel className="size-4" /> {lot.bids} lances
          </p>
          <div className="mt-auto">
            <p className="text-sm text-muted-foreground">Lance atual</p>
            <p className="text-2xl font-extrabold text-price sm:text-3xl">{brl(lot.currentBid)}</p>
            <p className="whitespace-nowrap text-xs text-muted-foreground line-through sm:text-sm">
              Lance mínimo: {brl(lot.nextBid)}
            </p>
          </div>
          <Countdown seconds={lot.endsInSeconds} className="w-full justify-between" />
          <span className="inline-flex h-11 items-center justify-center rounded-md bg-price text-sm font-bold text-primary-foreground transition-opacity group-hover:opacity-90">
            Dar lance agora
          </span>
        </div>
      </Link>
    </article>
  );
}
