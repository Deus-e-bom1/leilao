import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Gift, PartyPopper, X } from "lucide-react";

import {
  activatePromo,
  isPromoActive,
  markPromoShown,
  wasPromoShown,
} from "@/lib/promo";

export function ExitPromoPopup() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (isPromoActive() || wasPromoShown()) return;
    if (pathname.startsWith("/checkout")) return;

    function show() {
      if (wasPromoShown() || isPromoActive()) return;
      markPromoShown();
      setOpen(true);
    }

    // Desktop: mouse sai da janela pelo topo (barra de abas/endereço)
    function onMouseOut(event: MouseEvent) {
      if (!event.relatedTarget && event.clientY <= 0) show();
    }

    // Mobile: botão voltar do navegador
    window.history.pushState({ exitPromoGuard: true }, "");
    function onPopState() {
      show();
      window.history.pushState({ exitPromoGuard: true }, "");
    }

    document.addEventListener("mouseout", onMouseOut);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("popstate", onPopState);
    };
  }, [pathname]);

  if (!open) return null;

  function handleAcquire() {
    activatePromo();
    setOpen(false);
    window.location.reload();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Promoção exclusiva"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-2xl">
        <button
          onClick={() => setOpen(false)}
          aria-label="Fechar promoção"
          className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-card/80 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="relative h-28 bg-primary">
          <div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2">
            <div className="grid size-20 place-items-center rounded-full border-4 border-card bg-card shadow-lg">
              <Gift className="size-9 text-urgent" />
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-14 text-center">
          <h2 className="flex items-center justify-center gap-2 text-2xl font-extrabold text-primary">
            <PartyPopper className="size-6" /> Parabéns!
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-foreground">
            Você foi a pessoa número{" "}
            <span className="font-bold text-destructive">3.000</span> a entrar no
            site da Casas Bahia
          </p>
          <p className="mt-3 text-sm leading-relaxed text-foreground">
            Como recompensa, iremos liberar{" "}
            <span className="font-bold">promoções exclusivas</span> para você
          </p>
          <button
            onClick={handleAcquire}
            className="mt-6 h-12 w-full rounded-lg bg-live text-base font-bold text-live-foreground shadow-md transition-transform hover:scale-[1.02]"
          >
            Clique aqui para adquirir
          </button>
        </div>
      </div>
    </div>
  );
}
