import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Lock,
  ScanLine,
  Shield,
  X,
  Zap,
} from "lucide-react";
import QRCode from "qrcode";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brl, getLot, lots, type Lot } from "@/data/lots";
import { createPixCharge, getPixOrderStatus } from "@/lib/pix.functions";
import {
  clearBidSlugs,
  readBidSlugs,
  writeBidSlugs,
} from "@/lib/my-bids";
import { readTracking } from "@/lib/tracking";


type CheckoutSearch = { lote?: string | undefined };

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => ({
    lote: typeof search["lote"] === "string" ? (search["lote"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Finalizar retirada e entrega — Leilões" },
      {
        name: "description",
        content:
          "Confirme seus dados, escolha o frete e finalize o pagamento via Pix dos itens arrematados.",
      },
      { property: "og:title", content: "Finalizar retirada e entrega — Leilões" },
      {
        property: "og:description",
        content: "Revise seu arremate, informe o endereço e conclua o pagamento via Pix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Checkout,
});

type ShippingId = "economico" | "prioritario" | "expresso";

const shippingOptions: {
  id: ShippingId;
  name: string;
  price: number;
  eta: string;
  note: string;
}[] = [
  {
    id: "economico",
    name: "Frete Econômico",
    price: 0,
    eta: "Entrega estimada: 8 a 15 dias úteis",
    note: "Rastreamento disponível",
  },
  {
    id: "prioritario",
    name: "Frete Prioritário",
    price: 23.47,
    eta: "Entrega estimada: 5 a 9 dias úteis",
    note: "Prioridade na separação e postagem",
  },
  {
    id: "expresso",
    name: "Frete Expresso",
    price: 37.83,
    eta: "Entrega estimada: 4 a 5 dias úteis",
    note: "Processamento prioritário + modalidade de entrega mais rápida",
  },
];

function maskCep(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

function maskCpf(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function maskPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

function Checkout() {
  const { lote } = Route.useSearch();
  const [items, setItems] = useState<Lot[]>([]);
  const [stage, setStage] = useState<"form" | "pix">("form");
  const [pix, setPix] = useState<{ orderId: string; pixCode: string; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState("");
  const startPix = useServerFn(createPixCharge);


  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [district, setDistrict] = useState("");
  const [cityState, setCityState] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");

  const [shipping, setShipping] = useState<ShippingId>("economico");

  useEffect(() => {
    let slugs = readBidSlugs();
    if (lote && !slugs.includes(lote)) slugs = [...slugs, lote];
    const resolved = slugs.map((s) => getLot(s)).filter((l): l is Lot => Boolean(l));
    setItems(resolved.length > 0 ? resolved : [lots[0]!]);
  }, [lote]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("delivery-location");
      if (!saved) return;
      const parsed = JSON.parse(saved) as { cep?: string };
      if (parsed.cep) setCep(maskCep(parsed.cep));
    } catch {
      /* sem localização salva */
    }
  }, []);

  useEffect(() => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    let cancelled = false;
    setCepLoading(true);
    setCepError("");
    void fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then((r) => r.json() as Promise<Record<string, string | boolean>>)
      .then((data) => {
        if (cancelled) return;
        if (data["erro"]) {
          setCepError("CEP não encontrado. Confira o número digitado.");
          return;
        }
        setStreet(String(data["logradouro"] ?? ""));
        setDistrict(String(data["bairro"] ?? ""));
        setCityState(`${String(data["localidade"] ?? "")} - ${String(data["uf"] ?? "")}`);
      })
      .catch(() => {
        if (!cancelled) setCepError("Não foi possível consultar o CEP agora.");
      })
      .finally(() => {
        if (!cancelled) setCepLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cep]);

  const subtotal = items.reduce((sum, l) => sum + l.nextBid, 0);
  const shippingPrice = shippingOptions.find((o) => o.id === shipping)?.price ?? 0;
  const total = subtotal + shippingPrice;

  const personalOk =
    name.trim().length > 2 &&
    cpf.replace(/\D/g, "").length === 11 &&
    /\S+@\S+\.\S+/.test(email) &&
    phone.replace(/\D/g, "").length >= 10;
  const addressOk =
    cep.replace(/\D/g, "").length === 8 &&
    street.trim().length > 2 &&
    number.trim().length > 0 &&
    district.trim().length > 1 &&
    cityState.trim().length > 3;
  const canFinish = items.length > 0 && personalOk && addressOk;

  function removeItem(slug: string) {
    const next = items.filter((l) => l.slug !== slug);
    setItems(next);
    writeBidSlugs(next.map((l) => l.slug));
  }

  async function finish() {
    setSubmitting(true);
    setPayError("");
    const [city = "", state = ""] = cityState.split("-").map((p) => p.trim());
    try {
      const result = await startPix({
        data: {
          name: name.trim(),
          document: cpf,
          email: email.trim(),
          phone,
          cep,
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim(),
          district: district.trim(),
          city,
          state,
          shippingMethod: shipping,
          shippingCents: Math.round(shippingPrice * 100),
          items: items.map((l) => ({
            slug: l.slug,
            title: l.title,
            priceCents: Math.round(l.nextBid * 100),
          })),
          tracking: readTracking(),
        },
      });
      if (!result.ok) {
        setPayError(result.error);
        return;
      }
      setPix({ orderId: result.orderId, pixCode: result.pixCode, total: result.amountCents / 100 });
      setStage("pix");
    } catch {
      setPayError("Não foi possível gerar o Pix agora. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (stage === "pix" && pix) {
    return (
      <PixStage
        total={pix.total}
        orderId={pix.orderId}
        pixCode={pix.pixCode}
        productLabel={items.map((l) => l.title).join(" + ")}
        onBack={() => setStage("form")}
      />
    );
  }


  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[720px] px-4 py-6">
        <h1 className="text-2xl font-extrabold text-primary sm:text-3xl">
          Finalizar retirada e entrega
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirme seus dados para receber ou retirar o item que você arrematou.
        </p>

        {/* Seu arremate */}
        <section className="mt-5 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-bold">Seu arremate</h2>
          <ul className="mt-3 divide-y divide-border">
            {items.map((l) => (
              <li key={l.slug} className="flex items-center gap-3 py-3">
                <img
                  src={l.images[0]!.url}
                  alt={l.images[0]!.alt}
                  className="size-14 shrink-0 rounded-md object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug">{l.title}</p>
                  <p className="mt-0.5 text-sm font-bold text-success">{brl(l.nextBid)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(l.slug)}
                  aria-label={`Remover ${l.title}`}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-5" />
                </button>
              </li>
            ))}
            {items.length === 0 && (
              <li className="py-4 text-sm text-muted-foreground">
                Nenhum item no seu arremate.{" "}
                <Link to="/" className="font-semibold text-primary">
                  Escolher produtos
                </Link>
              </li>
            )}
          </ul>
          <dl className="space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Subtotal ({items.length} {items.length === 1 ? "item" : "itens"})
              </dt>
              <dd className="font-bold">{brl(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Frete</dt>
              <dd className={shippingPrice === 0 ? "font-bold text-success" : "font-bold"}>
                {shippingPrice === 0 ? "Grátis" : brl(shippingPrice)}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <dt className="text-base font-bold">Total</dt>
              <dd className="text-base font-extrabold">{brl(total)}</dd>
            </div>
          </dl>
        </section>

        {/* Dados pessoais */}
        <section className="mt-5 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-bold">Dados pessoais</h2>
          <div className="mt-3 space-y-3">
            <Field label="Nome completo" value={name} onChange={setName} placeholder="" />
            <Field
              label="CPF"
              value={cpf}
              onChange={(v) => setCpf(maskCpf(v))}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
            <Field
              label="E-mail"
              value={email}
              onChange={setEmail}
              placeholder="voce@email.com"
              type="email"
            />
            <Field
              label="Telefone"
              value={phone}
              onChange={(v) => setPhone(maskPhone(v))}
              placeholder="(00) 00000-0000"
              inputMode="tel"
            />
          </div>
        </section>

        {/* Endereço */}
        <section className="mt-5 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-bold">Endereço de entrega ou retirada</h2>
          <div className="mt-3 space-y-3">
            <Field
              label="CEP"
              value={cep}
              onChange={(v) => setCep(maskCep(v))}
              placeholder="00000-000"
              inputMode="numeric"
            />
            {cepLoading && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Buscando endereço…
              </p>
            )}
            {cepError && <p className="text-xs font-medium text-destructive">{cepError}</p>}
            <Field label="Rua / Logradouro" value={street} onChange={setStreet} placeholder="" />
            <Field label="Número" value={number} onChange={setNumber} placeholder="" />
            <Field
              label="Complemento"
              value={complement}
              onChange={setComplement}
              placeholder="Opcional"
            />
            <Field label="Bairro" value={district} onChange={setDistrict} placeholder="" />
            <Field label="Cidade / Estado" value={cityState} onChange={setCityState} placeholder="" />
          </div>
        </section>

        {/* Frete */}
        {addressOk && (
          <section className="mt-5 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-bold">Escolha o frete</h2>
            <div className="mt-3 space-y-3">
              {shippingOptions.map((o) => {
                const selected = shipping === o.id;
                return (
                  <label
                    key={o.id}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${
                      selected ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="frete"
                      checked={selected}
                      onChange={() => setShipping(o.id)}
                      className="mt-1 size-4 accent-[var(--primary)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold">{o.name}</span>
                        <span
                          className={`text-sm font-bold ${
                            o.price === 0 ? "text-success" : "text-foreground"
                          }`}
                        >
                          {o.price === 0 ? "GRÁTIS" : brl(o.price)}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">{o.eta}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground/70">
                        {o.note}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        <button
          type="button"
          disabled={!canFinish || submitting}
          onClick={() => void finish()}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-success py-4 text-base font-bold text-success-foreground transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting && <Loader2 className="size-5 animate-spin" />}
          {submitting ? "Gerando Pix…" : "Finalizar pedido"}
        </button>
        {payError && (
          <p className="mt-2 text-center text-xs font-medium text-destructive">{payError}</p>
        )}
        {!canFinish && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Preencha seus dados pessoais e o endereço para continuar.
          </p>
        )}

      </main>
      <SiteFooter />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  inputMode?: "numeric" | "tel";
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        {...(inputMode ? { inputMode } : {})}
        className="mt-1 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function PixStage({
  total,
  productLabel,
  pixCode,
  orderId,
  onBack,
}: {
  total: number;
  productLabel: string;
  pixCode: string;
  orderId: string;
  onBack: () => void;
}) {
  const [seconds, setSeconds] = useState(600);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState("");
  const [paid, setPaid] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkStatus = useServerFn(getPixOrderStatus);

  const { status, proceed, reset } = useBlocker({
    shouldBlockFn: async () => !paid,
    withResolver: true,
  });

  const [exitFromButton, setExitFromButton] = useState(false);
  const showExit = status === "blocked" || exitFromButton;

  function confirmExit() {
    if (exitFromButton) {
      setExitFromButton(false);
      onBack();
      return;
    }
    proceed?.();
  }

  function cancelExit() {
    if (exitFromButton) {
      setExitFromButton(false);
      return;
    }
    reset?.();
  }

  useEffect(() => {
    void QRCode.toDataURL(pixCode, { margin: 1, width: 480 }).then(setQr);
  }, [pixCode]);

  useEffect(() => {
    if (paid) return;
    let cancelled = false;
    const id = setInterval(() => {
      void checkStatus({ data: { orderId } })
        .then((r) => {
          if (!cancelled && r.status === "paid") {
            setPaid(true);
            try {
              clearBidSlugs();
            } catch {
              /* armazenamento indisponível */
            }
          }
        })
        .catch(() => {
          /* tenta novamente no próximo ciclo */
        });
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [checkStatus, orderId, paid]);


  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const digits = [mm[0]!, mm[1]!, ss[0]!, ss[1]!];

  async function copy() {
    try {
      await navigator.clipboard.writeText(pixCode);
      setCopied(true);
      copyTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard indisponível */
    }
  }

  if (paid) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-[520px] px-4 py-10 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-success/15">
            <CheckCircle2 className="size-9 text-success" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-primary">Pagamento confirmado!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Recebemos {brl(total)} referente a {productLabel}. Você receberá os detalhes da entrega
            por e-mail.
          </p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
          >
            Voltar para os leilões
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[520px] px-4 py-6">
        <h1 className="text-center text-xl font-extrabold text-primary sm:text-2xl">
          Falta apenas finalizar o pagamento via Pix
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Copie o código abaixo e cole no app do seu banco para concluir.
        </p>

        <section className="mt-5 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-muted-foreground">Pague em até</span>
            <span className="flex items-center gap-1">
              <TimeBox>{digits[0]}</TimeBox>
              <TimeBox>{digits[1]}</TimeBox>
              <span className="px-0.5 text-lg font-extrabold text-live">:</span>
              <TimeBox>{digits[2]}</TimeBox>
              <TimeBox>{digits[3]}</TimeBox>
            </span>
          </div>

          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Valor a pagar</p>
              <p className="text-lg font-extrabold">{brl(total)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Produto</p>
              <p className="text-sm font-bold text-warning-foreground">{productLabel}</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border-2 border-dashed border-border p-4">
            {qr ? (
              <img src={qr} alt="QR Code do pagamento Pix" className="mx-auto w-full max-w-[240px]" />
            ) : (
              <div className="mx-auto grid h-[240px] max-w-[240px] place-items-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ScanLine className="size-3.5" /> Aponte a câmera
            </p>
          </div>

          <ul className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Badge icon={<Zap className="size-4" />} label={"Protegido\npelo Pix"} />
            <Badge icon={<Zap className="size-4" />} label={"Liberação em\naté 2 min."} />
            <Badge icon={<Shield className="size-4" />} label={"Ambiente\nseguro"} />
          </ul>

          <button
            type="button"
            onClick={() => void copy()}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground transition-colors hover:opacity-90"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Código copiado!" : "Copiar código Pix"}
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Confirmação automática assim que o pagamento cair.
          </p>

          <div className="mt-5 flex items-center justify-center gap-5 border-t border-border pt-4 text-xs font-medium text-success">
            <span className="flex items-center gap-1.5">
              <Lock className="size-3.5" /> Ambiente Seguro
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="size-3.5" /> Dados 100% Protegidos
            </span>
          </div>
        </section>

        <button
          type="button"
          onClick={onBack}
          className="mx-auto mt-4 block text-sm font-semibold text-primary"
        >
          Voltar aos dados de entrega
        </button>
      </main>
      <SiteFooter />

      {showExit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-title"
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/50 p-4"
        >
          <div className="w-full max-w-[340px] rounded-2xl bg-card p-6 text-center shadow-xl">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-warning/20">
              <AlertTriangle className="size-7 text-warning-foreground" />
            </span>
            <h2 id="exit-title" className="mt-4 text-lg font-extrabold text-primary">
              Espera, não sai ainda!
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Se você sair agora, vai perder a aprovação que conseguiu para comprar{" "}
              {productLabel} por {brl(total)}.
            </p>
            <button
              type="button"
              onClick={cancelExit}
              className="mt-5 w-full rounded-lg bg-primary py-3.5 text-sm font-bold text-primary-foreground transition-colors hover:opacity-90"
            >
              Continuar pagamento
            </button>
            <button
              type="button"
              onClick={confirmExit}
              className="mx-auto mt-3 block text-sm font-semibold text-primary"
            >
              Voltar mesmo assim
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TimeBox({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid size-8 place-items-center rounded-md bg-live text-base font-extrabold text-live-foreground">
      {children}
    </span>
  );
}

function Badge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
      <span className="text-success">{icon}</span>
      <span className="whitespace-pre-line leading-tight">{label}</span>
    </li>
  );
}
