import { Barcode, CreditCard, Facebook, Instagram, RefreshCcw, Youtube } from "lucide-react";

const categories = [
  "Leilão de veículos",
  "Leilão de imóveis",
  "Eletrônicos",
  "Móveis e decoração",
  "Joias e relógios",
  "Leilões judiciais",
];

const institutional = [
  "Quem somos",
  "Como funciona um leilão",
  "Trabalhe conosco",
  "Seja um vendedor",
  "Blog",
];

const help = [
  "Como dar lances",
  "Formas de pagamento",
  "Retirada e entrega",
  "Política de devolução",
  "Perguntas frequentes",
  "Termos e condições",
];

function FooterList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h2 className="text-xs font-extrabold uppercase text-footer-foreground">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm text-footer-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-12 bg-footer text-footer-foreground">
      <div className="mx-auto max-w-[1280px] px-6 py-10 sm:px-8 lg:py-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 md:gap-10">
          <FooterList title="Categorias mais buscadas" items={categories} />
          <FooterList title="Institucional" items={institutional} />
          <FooterList title="Ajuda" items={help} />

          <div className="col-span-2 md:col-span-1">
            <h2 className="text-xs font-extrabold uppercase">Formas de pagamento</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex h-9 items-center gap-2 rounded-md bg-footer-surface px-3 text-xs font-bold">
                <RefreshCcw className="size-4" /> Pix
              </span>
              <span className="inline-flex h-9 items-center gap-2 rounded-md bg-footer-surface px-3 text-xs font-bold">
                <CreditCard className="size-4" /> Cartão
              </span>
              <span className="inline-flex h-9 items-center gap-2 rounded-md bg-footer-surface px-3 text-xs font-bold">
                <Barcode className="size-4" /> Boleto
              </span>
            </div>

            <h2 className="mt-5 text-xs font-extrabold uppercase">Redes sociais</h2>
            <div className="mt-4 flex gap-2" aria-label="Redes sociais">
              {[Instagram, Facebook, Youtube].map((Icon, index) => (
                <span
                  key={index}
                  className="grid size-9 place-items-center rounded-md bg-footer-surface text-footer-muted"
                >
                  <Icon className="size-4" />
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-footer-border pt-5 text-xs leading-5 text-footer-subtle">
          <p>Preços e condições exclusivos para este site, podendo sofrer alterações sem aviso prévio.</p>
        </div>
      </div>
    </footer>
  );
}
