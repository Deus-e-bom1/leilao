import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  Check,
  ChevronRight,
  Heart,
  Share2,
  ShieldCheck,
  Star,
  StarHalf,
  Store,
  TriangleAlert,
} from "lucide-react";

import { Countdown } from "@/components/countdown";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brl, getLot } from "@/data/lots";
import { addBidSlug } from "@/lib/my-bids";

export const Route = createFileRoute("/lote/$slug")({
  loader: ({ params }) => {
    const lot = getLot(params.slug);
    if (!lot) throw notFound();
    return { lot };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Lote indisponível" }, { name: "robots", content: "noindex" }],
      };
    }
    const { lot } = loaderData;
    const title = `${lot.title} em leilão — lance atual ${brl(lot.currentBid)}`;
    const description = `Lote ${lot.code} com ${lot.bids} lances. Dê seu lance de ${brl(lot.nextBid)} e arremate em até 12x sem juros.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: LotPage,
});

const shipAddressSchema = z.object({
  localidade: z.string(),
  uf: z.string(),
});

function formatShipCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function LotPage() {
  const { lot } = Route.useLoaderData();
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<"descricao" | "historico" | "condicoes">("descricao");
  const [shipCep, setShipCep] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipError, setShipError] = useState("");
  const [shipLoading, setShipLoading] = useState(false);
  const [bidStep, setBidStep] = useState<"idle" | "analyzing" | "approved">("idle");
  const [bidCount, setBidCount] = useState(0);
  const [bidRepeated, setBidRepeated] = useState(false);
  const bidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (bidTimer.current) clearTimeout(bidTimer.current);
    };
  }, []);

  function handleBid() {
    setBidStep("analyzing");
    bidTimer.current = setTimeout(() => {
      const { repeated, count } = addBidSlug(lot.slug);
      setBidRepeated(repeated);
      setBidCount(count);
      setBidStep("approved");
    }, 2000);
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("delivery-location");
      if (!saved) return;
      const parsed: unknown = JSON.parse(saved);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "cep" in parsed &&
        "address" in parsed
      ) {
        const addr = shipAddressSchema.safeParse(parsed.address);
        if (addr.success) {
          setShipCep(String(parsed.cep));
          setShipCity(`${addr.data.localidade} - ${addr.data.uf}`);
        }
      }
    } catch {}
  }, []);

  async function handleShipSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const digits = shipCep.replace(/\D/g, "");
    if (!/^\d{8}$/.test(digits)) {
      setShipCity("");
      setShipError("Digite um CEP válido com 8 números.");
      return;
    }
    setShipLoading(true);
    setShipError("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${encodeURIComponent(digits)}/json/`);
      if (!response.ok) throw new Error("CEP request failed");
      const payload: unknown = await response.json();
      if (
        typeof payload === "object" &&
        payload !== null &&
        "erro" in payload &&
        payload.erro === true
      ) {
        setShipCity("");
        setShipError("CEP não encontrado. Confira os números e tente novamente.");
        return;
      }
      const parsed = shipAddressSchema.safeParse(payload);
      if (!parsed.success) throw new Error("Invalid address response");
      setShipCity(`${parsed.data.localidade} - ${parsed.data.uf}`);
    } catch {
      setShipCity("");
      setShipError("Não foi possível consultar o CEP. Tente novamente.");
    } finally {
      setShipLoading(false);
    }
  }

  const ratingDist = [86, 8, 3, 2, 1];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1280px] px-4 py-6">
        <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {lot.breadcrumb.map((item, i) => (
            <span key={item} className="flex items-center gap-1">
              {i === 0 ? <Link to="/">{item}</Link> : <span>{item}</span>}
              {i < lot.breadcrumb.length - 1 && <ChevronRight className="size-3" />}
            </span>
          ))}
        </nav>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {lot.badge ? (
            <span
              className={`rounded-md px-2 py-1 text-[11px] font-bold tracking-wide ${
                lot.badgeTone === "new"
                  ? "bg-primary text-primary-foreground"
                  : "bg-urgent text-urgent-foreground"
              }`}
            >
              {lot.badge}
            </span>
          ) : (
            lot.live && (
              <span className="rounded-md bg-live px-2 py-1 text-[11px] font-bold tracking-wide text-live-foreground">
                AO VIVO
              </span>
            )
          )}
          <h1 className="text-2xl font-extrabold sm:text-3xl">{lot.title}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Cód. Leilão {lot.code} ·{" "}
          <span className="text-primary">Outros leilões de {lot.seller}</span>
        </p>

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div>
            <div className="relative rounded-xl border border-border bg-card p-6">
              <div className="absolute right-4 top-4 flex flex-col gap-2">
                <button
                  aria-label="Favoritar lote"
                  className="grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground"
                >
                  <Heart className="size-4" />
                </button>
                <button
                  aria-label="Compartilhar lote"
                  className="grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground"
                >
                  <Share2 className="size-4" />
                </button>
              </div>
              <img
                src={lot.images[active]!.url}
                alt={lot.images[active]!.alt}
                className="mx-auto aspect-square w-full max-w-[420px] object-contain"
              />
            </div>
            <div className="mt-3 flex gap-3">
              {lot.images.map((img, i) => (
                <button
                  key={img.url}
                  onClick={() => setActive(i)}
                  aria-label={`Ver imagem ${i + 1}`}
                  className={`size-16 overflow-hidden rounded-md border bg-card p-1 ${
                    i === active ? "border-primary" : "border-border"
                  }`}
                >
                  <img src={img.url} alt={img.alt} className="size-full object-contain" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm">
              <Store className="size-4 text-muted-foreground" /> Vendido e entregue por{" "}
              <span className="font-semibold text-primary">{lot.seller}</span>
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex text-warning">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star
                    key={i}
                    className={`size-4 ${i < Math.round(lot.rating) ? "fill-current" : ""}`}
                  />
                ))}
              </span>
              <span className="font-bold text-foreground">{lot.rating}</span> ·{" "}
              {lot.reviews} avaliações · {lot.questions} perguntas
            </p>

            <Countdown seconds={lot.endsInSeconds} />

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">
                Lance atual · {lot.bids} lances
              </p>
              <p className="text-4xl font-extrabold text-price">{brl(lot.currentBid)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Lance mínimo para continuar:{" "}
                <span className="font-bold text-foreground">{brl(lot.nextBid)}</span>
              </p>
              <button
                onClick={handleBid}
                className="mt-4 h-12 w-full rounded-md bg-success text-sm font-bold text-success-foreground transition-colors hover:bg-success/90"
              >
                Dar lance de {brl(lot.nextBid)}
              </button>
            </div>

            <div className="flex gap-3 rounded-xl border border-border bg-card p-5">
              <ShieldCheck className="size-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-bold">Pagamento facilitado</p>
                <p className="text-sm text-muted-foreground">
                  Arremates podem ser parcelados em até 12x sem juros após o fim do
                  leilão.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleShipSubmit}
              noValidate
              className="rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold">Calcular frete e prazo de entrega</p>
                <input
                  value={shipCep}
                  onChange={(event) => {
                    setShipCep(formatShipCep(event.target.value));
                    setShipError("");
                    setShipCity("");
                  }}
                  placeholder="00000-000"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={9}
                  aria-label="CEP para cálculo de frete"
                  className="ml-auto h-10 w-36 rounded-md border border-border bg-card px-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={shipLoading}
                  className="h-10 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground"
                >
                  {shipLoading ? "..." : "Consultar"}
                </button>
              </div>
              {shipCity && (
                <p className="mt-3 text-sm font-semibold text-success">
                  Entrega para {shipCity} em até 4 dias úteis após o fim do leilão.
                </p>
              )}
              {shipError && (
                <p className="mt-3 text-sm font-semibold text-destructive">{shipError}</p>
              )}
            </form>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start gap-6">
                <div>
                  <p className="text-5xl font-extrabold text-primary">
                    {lot.rating.toFixed(1).replace(".", ",")}
                  </p>
                  <p className="mt-1 flex text-primary">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star
                        key={i}
                        className={`size-5 ${i < Math.round(lot.rating) ? "fill-current" : "text-border"}`}
                      />
                    ))}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {lot.reviews.toLocaleString("pt-BR")} avaliações
                  </p>
                </div>
                <div className="min-w-[200px] flex-1 space-y-2">
                  {ratingDist.map((pct, i) => (
                    <div key={5 - i} className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full bg-muted-foreground"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="flex w-8 items-center gap-1 text-xs text-muted-foreground">
                        {5 - i} <Star className="size-3 fill-current" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-5 divide-y divide-border border-t border-border">
                {["Custo-benefício", "Qualidade do produto", "Prazo de entrega"].map((aspect) => (
                  <div key={aspect} className="flex items-center justify-between gap-4 py-3">
                    <p className="text-sm">{aspect}</p>
                    <p className="flex shrink-0 text-primary">
                      {[0, 1, 2, 3].map((i) => (
                        <Star key={i} className="size-4 fill-current" />
                      ))}
                      <StarHalf className="size-4 fill-current" />
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <section className="mt-10">
          <div className="flex flex-wrap gap-2 border-b border-border">
            {(
              [
                ["descricao", "Descrição do produto"],
                ["historico", "Histórico de lances"],
                ["condicoes", "Condições do leilão"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-t-md border-b-2 px-4 py-3 text-sm font-semibold ${
                  tab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "descricao" && (
            <div className="mt-6 grid gap-8 lg:grid-cols-2">
              <div>
                {lot.description.map((p) => (
                  <p key={p} className="mt-2 text-sm text-muted-foreground">
                    {p}
                  </p>
                ))}
              </div>
              <dl className="h-fit overflow-hidden rounded-xl border border-border bg-card text-sm">
                {lot.specs.map((s, i) => (
                  <div
                    key={s.label}
                    className={`flex justify-between gap-4 px-4 py-3 ${
                      i % 2 ? "bg-surface" : ""
                    }`}
                  >
                    <dt className="text-muted-foreground">{s.label}</dt>
                    <dd className="text-right font-medium">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {tab === "historico" && (
            <div className="mt-6 overflow-x-auto">
              {lot.bidHistory?.length ? (
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Arrematante</th>
                      <th className="py-2 pr-4 font-medium">Valor do lance</th>
                      <th className="py-2 font-medium">Quando</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lot.bidHistory.map((b, i) => (
                      <tr
                        key={`${b.bidder}-${b.when}`}
                        className={`border-b border-border ${i === 0 ? "font-bold text-primary" : ""}`}
                      >
                        <td className="py-3 pr-4">{b.bidder}</td>
                        <td className="py-3 pr-4">{brl(b.value)}</td>
                        <td className="py-3">{b.when}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum lance registrado até o momento.
                </p>
              )}
            </div>
          )}

          {tab === "condicoes" && (
            <div className="mt-6 max-w-3xl space-y-3">
              {(lot.conditions ?? []).map((c) => (
                <p key={c} className="text-sm text-muted-foreground">
                  {c}
                </p>
              ))}
              {!lot.conditions?.length && (
                <p className="text-sm text-muted-foreground">
                  Consulte as condições do leilão com o vendedor.
                </p>
              )}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />

      {bidStep !== "idle" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-live="polite"
        >
          <div className="w-full max-w-md rounded-2xl bg-card p-8 text-center shadow-xl">
            {bidStep === "analyzing" ? (
              <>
                <div
                  className="mx-auto size-12 animate-spin rounded-full border-4 border-border border-t-primary"
                  aria-hidden="true"
                />
                <h2 className="mt-6 text-xl font-extrabold text-foreground">
                  Analisando seu lance…
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Aguarde um instante enquanto confirmamos seu lance de{" "}
                  <span className="font-bold text-foreground">{brl(lot.nextBid)}</span>.
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success">
                  <Check className="size-8 text-success-foreground" strokeWidth={3} />
                </div>
                <h2 className="mt-5 text-xl font-extrabold text-foreground">
                  Lance aprovado!
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="font-bold text-foreground">{lot.title}</span> agora é
                  seu, por <span className="font-bold text-foreground">{brl(lot.nextBid)}</span>.
                </p>
                {bidRepeated && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-left">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                    <p className="text-xs text-foreground">
                      Este produto já estava nos seus lances. Você pode escolher
                      quantos produtos quiser.
                    </p>
                  </div>
                )}
                <button
                  onClick={() =>
                    navigate({ to: "/checkout", search: { lote: lot.slug } })
                  }
                  className="mt-5 h-12 w-full rounded-md bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Finalizar e pagar ({bidCount} {bidCount === 1 ? "item" : "itens"})
                </button>
                <button
                  onClick={() => navigate({ to: "/" })}
                  className="mt-3 h-12 w-full rounded-md border border-border bg-card text-sm font-bold text-primary transition-colors hover:bg-surface"
                >
                  Escolher mais produtos
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
