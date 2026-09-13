const UTMIFY_URL = "https://api.utmify.com.br/api-credentials/orders";

export type UtmifyStatus = "waiting_payment" | "paid" | "refused" | "refunded" | "chargedback";

type UtmifyOrderInput = {
  orderId: string;
  status: UtmifyStatus;
  platform: string;
  createdAt: string;
  approvedDate?: string | null;
  refundedAt?: string | null;
  customer: {
    name: string;
    email: string;
    phone: string | null;
    document: string | null;
    ip?: string | null;
  };
  products: { id: string; name: string; quantity: number; priceInCents: number }[];
  trackingParameters: Record<string, string | null>;
  totalPriceInCents: number;
};

/** Formato de data exigido pela Utmify: "YYYY-MM-DD HH:MM:SS" em UTC. */
export function utmifyDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/** Envia (ou atualiza) o pedido no painel da Utmify. Falhas não interrompem o checkout. */
export async function sendUtmifyOrder(order: UtmifyOrderInput): Promise<boolean> {
  const token = process.env["UTMIFY_API_TOKEN"];
  if (!token) {
    console.warn("[utmify] UTMIFY_API_TOKEN ausente; pedido não enviado");
    return false;
  }

  const body = {
    orderId: order.orderId,
    platform: order.platform,
    paymentMethod: "pix",
    status: order.status,
    createdAt: order.createdAt,
    approvedDate: order.approvedDate ?? null,
    refundedAt: order.refundedAt ?? null,
    customer: {
      name: order.customer.name,
      email: order.customer.email,
      phone: order.customer.phone,
      document: order.customer.document,
      country: "BR",
      ip: order.customer.ip ?? null,
    },
    products: order.products.map((p) => ({
      id: p.id,
      name: p.name,
      planId: null,
      planName: null,
      quantity: p.quantity,
      priceInCents: p.priceInCents,
    })),
    trackingParameters: {
      src: order.trackingParameters["src"] ?? null,
      sck: order.trackingParameters["sck"] ?? null,
      utm_source: order.trackingParameters["utm_source"] ?? null,
      utm_campaign: order.trackingParameters["utm_campaign"] ?? null,
      utm_medium: order.trackingParameters["utm_medium"] ?? null,
      utm_content: order.trackingParameters["utm_content"] ?? null,
      utm_term: order.trackingParameters["utm_term"] ?? null,
    },
    commission: {
      totalPriceInCents: order.totalPriceInCents,
      gatewayFeeInCents: 0,
      userCommissionInCents: order.totalPriceInCents,
      currency: "BRL",
    },
    isTest: false,
  };

  try {
    const response = await fetch(UTMIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-token": token },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error("[utmify] falha ao enviar pedido", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("[utmify] erro de comunicação", error);
    return false;
  }
}
