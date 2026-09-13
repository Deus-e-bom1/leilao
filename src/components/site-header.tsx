import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { z } from "zod";
import { brl, getLot, type Lot } from "@/data/lots";
const logoAsset = { url: "/images/logo.svg" };
import {
  onBidSlugsChange,
  readBidSlugs,
  writeBidSlugs,
} from "@/lib/my-bids";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accessibility,
  ChevronDown,
  Heart,
  MapPin,
  Menu,
  Search,
  ShoppingCart,
  User,
  X,
} from "lucide-react";

const categories = [
  "Eletrônicos",
  "Veículos",
  "Imóveis",
  "Joias & Relógios",
  "Móveis",
  "Arte & Colecionáveis",
];

const addressSchema = z.object({
  logradouro: z.string(),
  bairro: z.string(),
  localidade: z.string(),
  uf: z.string(),
});

type Address = z.infer<typeof addressSchema>;

function formatCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function SiteHeader() {
  const [promoOpen, setPromoOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cepOpen, setCepOpen] = useState(false);
  const [cep, setCep] = useState("");
  const [address, setAddress] = useState<Address | null>(null);
  const [cepError, setCepError] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<Lot[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const closeTimer = useRef<number | null>(null);

  function readCart(): Lot[] {
    return readBidSlugs()
      .map((s) => getLot(s))
      .filter((l): l is Lot => Boolean(l));
  }

  function openCart() {
    setCartItems(readCart());
    setCartOpen(true);
  }

  function removeFromCart(slug: string) {
    const next = cartItems.filter((l) => l.slug !== slug);
    setCartItems(next);
    writeBidSlugs(next.map((l) => l.slug));
  }

  const cartTotal = cartItems.reduce((sum, l) => sum + l.currentBid, 0);

  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  useEffect(() => {
    const sync = () => setCartCount(readBidSlugs().length);
    sync();
    return onBidSlugsChange(sync);
  }, []);

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
        const addr = addressSchema.safeParse(parsed.address);
        if (addr.success) {
          setAddress(addr.data);
          setCep(String(parsed.cep));
        }
      }
    } catch {}
  }, []);

  function openCepDialog() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setCepOpen(true);
  }


  const locationLabel = address ? `${address.localidade} - ${address.uf}` : "Informe seu CEP";
  const fullAddress = address
    ? [address.logradouro, address.bairro, `${address.localidade} - ${address.uf}`]
        .filter(Boolean)
        .join(", ")
    : "";

  async function handleCepSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const digits = cep.replace(/\D/g, "");

    if (!/^\d{8}$/.test(digits)) {
      setAddress(null);
      setCepError("Digite um CEP válido com 8 números.");
      return;
    }

    setCepLoading(true);
    setCepError("");
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
        setAddress(null);
        setCepError("CEP não encontrado. Confira os números e tente novamente.");
        return;
      }

      const parsedAddress = addressSchema.safeParse(payload);
      if (!parsedAddress.success) throw new Error("Invalid address response");
      setAddress(parsedAddress.data);
      try {
        window.localStorage.setItem(
          "delivery-location",
          JSON.stringify({ cep: formatCep(digits), address: parsedAddress.data }),
        );
      } catch {}
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
      closeTimer.current = window.setTimeout(() => setCepOpen(false), 3000);
    } catch {
      setAddress(null);
      setCepError("Não foi possível consultar o CEP. Tente novamente.");
    } finally {
      setCepLoading(false);
    }
  }

  return (
    <header className="border-b border-border bg-card">
      {/* Barra promocional */}
      {promoOpen && (
        <div className="bg-primary text-primary-foreground">
          {/* Mobile: linha única com chevron e fechar */}
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 md:hidden">
            <button
              type="button"
              className="flex min-w-0 items-center gap-1 text-left text-sm"
              aria-label="Ver ofertas"
            >
              <span className="truncate">
                Receba em primeira mão{" "}
                <span className="font-bold">ofertas exclusivas</span>
              </span>
              <ChevronDown className="size-4 shrink-0" />
            </button>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => setPromoOpen(false)}
              className="shrink-0"
            >
              <X className="size-5" />
            </button>
          </div>
          {/* Desktop: formulário completo */}
          <div className="mx-auto hidden max-w-[1280px] items-center justify-between gap-3 px-4 py-3 text-sm md:flex">
            <p className="font-semibold">
              Receba em primeira mão ofertas exclusivas
            </p>
            <form className="flex gap-2">
              <input
                type="email"
                placeholder="Digite seu e-mail"
                className="h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none"
              />
              <input
                type="tel"
                placeholder="Digite seu telefone"
                className="h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none"
              />
              <button
                type="button"
                className="h-10 rounded-md bg-warning px-5 text-sm font-bold text-warning-foreground"
              >
                Receber
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Linha principal: menu, logo e ações */}
      <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-4 py-4">
        <button
          type="button"
          aria-label="Abrir menu de categorias"
          onClick={() => setMenuOpen((v) => !v)}
          className="shrink-0 text-primary md:hidden"
        >
          <Menu className="size-7" />
        </button>

        <Link to="/" className="shrink-0" aria-label="Página inicial">
          <img
            src={logoAsset.url}
            alt="ASA Bahia Leilões"
            className="h-6 w-auto max-w-[170px] object-contain md:h-7 md:max-w-none"
          />
        </Link>

        <form className="hidden min-w-0 flex-1 items-center md:flex">
          <input
            type="search"
            placeholder="O que você está procurando?"
            className="h-11 min-w-0 flex-1 rounded-l-md border border-border bg-card px-4 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            aria-label="Buscar"
            className="flex h-11 items-center rounded-r-md bg-primary px-5 text-primary-foreground"
          >
            <Search className="size-5" />
          </button>
        </form>

        <Button
          type="button"
          variant="ghost"
          onClick={openCepDialog}
          className="hidden h-auto items-center gap-1 px-1 py-1 text-sm text-muted-foreground lg:flex"
        >
          <MapPin className="size-4" /> {locationLabel}
        </Button>

        <div className="ml-auto flex shrink-0 items-center gap-3 text-primary md:gap-5 md:text-muted-foreground">
          <button
            aria-label="Acesse sua conta"
            className="flex items-center gap-2 text-sm"
          >
            <User className="size-6 md:size-5" />
            <span className="hidden sm:inline">Acesse sua conta</span>
          </button>
          <button aria-label="Favoritos">
            <Heart className="size-6 md:size-5" />
          </button>
          <button
            aria-label={
              cartCount > 0
                ? `Meus lances: ${cartCount} ${cartCount === 1 ? "produto" : "produtos"}`
                : "Meus lances"
            }
            onClick={openCart}
            className="relative"
          >
            <ShoppingCart className="size-6 md:size-5" />
            {cartCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute -top-2 -right-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-card"
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Busca mobile em largura total */}
      <div className="px-4 pb-3 md:hidden">
        <form className="flex items-center rounded-full border border-border bg-card px-4">
          <input
            type="search"
            placeholder="O que você está procurando?"
            className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <button type="button" aria-label="Buscar" className="shrink-0 text-muted-foreground">
            <Search className="size-5" />
          </button>
        </form>
      </div>

      {/* CEP mobile */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3 md:hidden">
        <Button
          type="button"
          variant="ghost"
          onClick={openCepDialog}
          className="h-auto min-w-0 justify-start gap-2 px-0 py-0 text-sm font-medium text-primary hover:bg-transparent hover:text-primary"
        >
          <MapPin className="size-5" /> <span className="truncate">{locationLabel}</span>
        </Button>
        <button aria-label="Acessibilidade" className="text-primary">
          <Accessibility className="size-5" />
        </button>
      </div>

      {/* Categorias */}
      <nav className="mx-auto max-w-[1280px] px-4 pb-3">
        <ul
          className={`items-center gap-5 overflow-x-auto text-sm font-medium whitespace-nowrap ${
            menuOpen ? "flex flex-col items-start gap-3" : "hidden md:flex"
          }`}
        >
          <li className="hidden items-center gap-2 font-semibold md:flex">
            <Menu className="size-4" /> Categorias
          </li>
          {categories.map((c) => (
            <li key={c} className="text-foreground/80">
              {c}
            </li>
          ))}
          <li>
            <span className="rounded-full bg-live px-3 py-1 text-xs font-bold text-live-foreground">
              Leilões Judiciais
            </span>
          </li>
        </ul>
      </nav>

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="flex max-h-[85vh] w-[calc(100%-2rem)] max-w-[420px] flex-col gap-0 overflow-hidden rounded-lg border-0 bg-background p-0 shadow-lg">
          <DialogHeader className="bg-primary px-6 py-5 text-left">
            <DialogTitle className="text-xl font-bold text-primary-foreground">
              Meus lances
            </DialogTitle>
            <DialogDescription className="text-sm text-primary-foreground/80">
              {cartItems.length === 1
                ? "1 produto arrematado aguardando pagamento"
                : `${cartItems.length} produtos arrematados aguardando pagamento`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {cartItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Você ainda não possui lances aprovados.
              </p>
            ) : (
              <ul className="space-y-4">
                {cartItems.map((item) => (
                  <li key={item.slug} className="flex items-center gap-3">
                    <Link
                      to="/lote/$slug"
                      params={{ slug: item.slug }}
                      onClick={() => setCartOpen(false)}
                      className="shrink-0"
                    >
                      <img
                        src={item.images[0]?.url}
                        alt={item.images[0]?.alt ?? item.title}
                        className="size-16 rounded-md border border-border object-cover"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/lote/$slug"
                        params={{ slug: item.slug }}
                        onClick={() => setCartOpen(false)}
                        className="line-clamp-2 text-sm font-medium text-foreground hover:text-primary"
                      >
                        {item.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Lote {item.code}
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-success">
                        {brl(item.currentBid)}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remover ${item.title}`}
                      onClick={() => removeFromCart(item.slug)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {cartItems.length > 0 && (
            <div className="border-t border-border px-6 py-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total dos lances</span>
                <span className="text-lg font-bold text-foreground">
                  {brl(cartTotal)}
                </span>
              </div>
              <Link to="/checkout" onClick={() => setCartOpen(false)}>
                <Button className="h-11 w-full bg-success text-base font-bold text-success-foreground hover:bg-success/90">
                  Finalizar e pagar
                </Button>
              </Link>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={cepOpen} onOpenChange={setCepOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[420px] gap-0 overflow-hidden rounded-lg border-0 bg-background p-0 shadow-lg [&>button]:right-6 [&>button]:top-5 [&>button]:text-primary-foreground [&>button]:opacity-100">
          <DialogHeader className="bg-primary px-6 py-5 pr-14 text-left">
            <DialogTitle className="text-xl font-bold text-primary-foreground">
              Escolha sua localização
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-12 pt-7">
            <DialogDescription className="mb-4 text-base leading-6 text-foreground">
              A gente te ajuda a encontrar o seu produto com menor frete e prazo de entrega.
            </DialogDescription>

            <form onSubmit={handleCepSubmit} noValidate>
              <label htmlFor="delivery-cep" className="mb-1.5 block text-sm font-semibold text-foreground">
                Digite seu CEP
              </label>
              <div className="flex items-stretch gap-2.5">
                <input
                  id="delivery-cep"
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={9}
                  value={cep}
                  onChange={(event) => {
                    setCep(formatCep(event.target.value));
                    setCepError("");
                    setAddress(null);
                  }}
                  placeholder="_____-___"
                  aria-invalid={Boolean(cepError)}
                  aria-describedby="cep-feedback"
                  className="h-11 min-w-0 flex-1 rounded-md border-2 border-foreground bg-card px-3 text-base text-foreground outline-none focus:border-primary"
                />
                <Button type="submit" disabled={cepLoading} className="h-11 px-5 text-base font-bold">
                  {cepLoading ? "Buscando..." : "Confirmar"}
                </Button>
              </div>
              <div id="cep-feedback" aria-live="polite" className="min-h-6 pt-1 text-sm font-semibold">
                {address && (
                  <div className="space-y-1">
                    <p className="text-success">{fullAddress}</p>
                    <p className="text-xs font-medium text-muted-foreground">
                      Endereço confirmado. Fechando em instantes...
                    </p>
                  </div>
                )}
                {cepError && <p className="text-destructive">{cepError}</p>}
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
