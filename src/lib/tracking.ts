const STORAGE_KEY = "tracking-params";

export type TrackingParams = {
  src: string | null;
  sck: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  utm_term: string | null;
};

const EMPTY: TrackingParams = {
  src: null,
  sck: null,
  utm_source: null,
  utm_campaign: null,
  utm_medium: null,
  utm_content: null,
  utm_term: null,
};

const KEYS = Object.keys(EMPTY) as (keyof TrackingParams)[];

/** Guarda os parâmetros de campanha da URL para atribuir a venda na Utmify. */
export function captureTracking(): void {
  if (typeof window === "undefined") return;
  try {
    const search = new URLSearchParams(window.location.search);
    const stored = readTracking();
    let changed = false;
    for (const key of KEYS) {
      const value = search.get(key);
      if (value && value.trim()) {
        stored[key] = value.trim().slice(0, 300);
        changed = true;
      }
    }
    if (changed) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* armazenamento indisponível */
  }
}

export function readTracking(): TrackingParams {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<TrackingParams>;
    const result = { ...EMPTY };
    for (const key of KEYS) {
      const value = parsed[key];
      if (typeof value === "string" && value) result[key] = value;
    }
    return result;
  } catch {
    return { ...EMPTY };
  }
}
