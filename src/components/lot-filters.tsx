import { ChevronUp } from "lucide-react";

const groups = [
  {
    title: "Categoria",
    options: ["Móveis", "Eletrônicos", "Ferramentas", "Casa e Cozinha"],
  },
  {
    title: "Status do leilão",
    options: ["Ao vivo agora", "Encerrando hoje", "Recém-publicado"],
  },
  {
    title: "Faixa de lance",
    options: ["Até R$ 500"],
  },
];

export type LotFilterValue = string;

export function LotFilters({
  selected = [],
  onChange,
}: {
  selected?: LotFilterValue[];
  onChange?: (value: LotFilterValue, checked: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section
          key={group.title}
          className="rounded-lg border border-border bg-card p-4"
        >
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-bold">{group.title}</h2>
            <ChevronUp className="size-4 text-muted-foreground" />
          </header>
          <ul className="mt-3 space-y-3">
            {group.options.map((option) => (
              <li key={option}>
                <label className="flex items-center gap-3 text-sm text-foreground/80">
                  <input
                    type="checkbox"
                     checked={selected.includes(option)}
                     onChange={(event) => onChange?.(option, event.target.checked)}
                    className="size-4 rounded border-border accent-primary"
                  />
                  {option}
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
