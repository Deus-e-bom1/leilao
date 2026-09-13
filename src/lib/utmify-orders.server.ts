import { sendUtmifyOrder, utmifyDate, type UtmifyStatus } from "./utmify.server";

type OrderItem = { slug?: string; title?: string; priceCents?: number };

const STATUS_MAP: Record<string, UtmifyStatus> = {
  pending: "waiting_payment",
  waiting_payment: "waiting_payment",
  processing: "waiting_payment",
  paid: "paid",
  approved: "paid",
  refused: "refused",
  failed: "refused",
  cancelled: "refused",
  canceled: "refused",
  refunded: "refunded",
  chargedback: "chargedback",
};

/** Espelha o pedido no painel da Utmify (pendente / aprovado), sem quebrar o fluxo de pagamento. */
export async function syncOrderToUtmify(orderId: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("pix_orders")
      .select(
        "id, status, amount_cents, customer_name, customer_email, customer_phone, customer_document, customer_ip, items, tracking, created_at, paid_at, utmify_status",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) return;

    const status = STATUS_MAP[order.status] ?? "waiting_payment";
    if (order.utmify_status === status) return;

    const items = (Array.isArray(order.items) ? order.items : []) as OrderItem[];
    const products = items.map((item, index) => ({
      id: item.slug ?? `item-${index + 1}`,
      name: item.title ?? "Produto",
      quantity: 1,
      priceInCents: item.priceCents ?? 0,
    }));

    const sent = await sendUtmifyOrder({
      orderId: order.id,
      status,
      // O nome do produto arrematado identifica a venda no painel.
      platform: items[0]?.title ?? "Leilão",
      createdAt: utmifyDate(order.created_at) ?? utmifyDate(new Date())!,
      approvedDate: status === "paid" ? (utmifyDate(order.paid_at) ?? utmifyDate(new Date())) : null,
      refundedAt: status === "refunded" ? utmifyDate(new Date()) : null,
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone,
        document: order.customer_document,
        ip: order.customer_ip ?? "0.0.0.0",
      },
      products,
      trackingParameters: (order.tracking ?? {}) as Record<string, string | null>,
      totalPriceInCents: order.amount_cents,
    });

    if (!sent) return;
    await supabaseAdmin.from("pix_orders").update({ utmify_status: status }).eq("id", order.id);
  } catch (err) {
    console.error("[utmify] sync falhou", err);
  }
}
