export const PROMO_STORAGE_KEY = "exit-promo-active";
export const PROMO_SHOWN_KEY = "exit-promo-shown";

export function isPromoActive(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.localStorage.getItem(PROMO_STORAGE_KEY) === "1"
    );
  } catch {
    return false;
  }
}

export function activatePromo() {
  try {
    window.localStorage.setItem(PROMO_STORAGE_KEY, "1");
  } catch {}
}

export function markPromoShown() {
  try {
    window.sessionStorage.setItem(PROMO_SHOWN_KEY, "1");
  } catch {}
}

export function wasPromoShown(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(PROMO_SHOWN_KEY) === "1"
    );
  } catch {
    return false;
  }
}
