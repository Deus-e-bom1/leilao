import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const SKALE_BASE_URL = "https://api.skalepayments.com.br";

const itemSchema = z.object({
  slug: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  priceCents: z.number().int().min(1).max(6_000_000),
});

const createPixInput = z.object({
  name: z.string().min(3).max(120),
  document: z.string().min(11).max(20),
  email: z.string().email().max(160),
  phone: z.string().min(10).max(20),
  cep: z.string().min(8).max(12),
  street: z.string().min(2).max(160),
  number: z.string().min(1).max(20),
  complement: z.string().max(120).optional().default(""),
  district: z.string().min(2).max(120),
  city: z.string().min(2).max(120),
  state: z.string().min(2).max(40),
  shippingMethod: z.string().min(1).max(40),
  shippingCents: z.number().int().min(0).max(1_000_000),
  items: z.array(itemSchema).min(1).max(30),
  tracking: z
    .object({
      src: z.string().max(300).nullable().optional(),
      sck: z.string().max(300).nullable().optional(),
      utm_source: z.string().max(300).nullable().optional(),
      utm_campaign: z.string().max(300).nullable().optional(),
      utm_medium: z.string().max(300).nullable().optional(),
      utm_content: z.string().max(300).nullable().optional(),
      utm_term: z.string().max(300).nullable().optional(),
    })
    .optional()
    .default({}),
});

type SkaleTransaction = {
  success?: boolean;
  id?: string;
  status?: string;
  message?: string;
  pix?: { qrcode?: string | null; end2EndId?: string | null; qrcodeImage?: string | null } | null;
};

/** Cria a cobrança Pix na Skalepay e registra o pedido. */
export const createPixCharge = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createPixInput.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["SKALEPAY_API_KEY"];
    if (!apiKey) {
      return { ok: false as const, error: "Pagamento indisponível no momento." };
    }

    const digits = (value: string) => value.replace(/\D/g, "");
    const itemsTotal = data.items.reduce((sum, i) => sum + i.priceCents, 0);
    const amount = itemsTotal + data.shippingCents;


    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error: insertError } = await supabaseAdmin
      .from("pix_orders")
      .insert({
        amount_cents: amount,
        shipping_method: data.shippingMethod,
        shipping_cents: data.shippingCents,
        customer_name: data.name,
        customer_document: digits(data.document),
        customer_email: data.email,
        customer_phone: digits(data.phone),
        customer_ip:
          (getRequestHeader("cf-connecting-ip") ??
            getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
            getRequestHeader("x-real-ip") ??
            "0.0.0.0") || "0.0.0.0",
        address: {
          cep: digits(data.cep),
          logradouro: data.street,
          numero: data.number,
          complemento: data.complement ?? "",
          bairro: data.district,
          cidade: data.city,
          estado: data.state,
          pais: "Brasil",
        },
        items: data.items,
        tracking: data.tracking ?? {},
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !order) {
      console.error("pix_orders insert failed", insertError);
      return { ok: false as const, error: "Não foi possível iniciar o pagamento." };
    }

    const origin = process.env["LOVABLE_PROJECT_URL"] ?? "";
    const postbackUrl = `${origin || "https://project--c4f47879-28ac-46a0-bad1-b4363040b83c.lovable.app"}/api/public/skalepay-webhook`;

    const body = {
      amount,
      paymentMethod: "pix",
      pix: { expiresInDays: 1 },
      customer: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        document: { number: digits(data.document), type: digits(data.document).length > 11 ? "cnpj" : "cpf" },
      },
      items: data.items.map((i) => ({
        title: i.title,
        unitPrice: i.priceCents,
        quantity: 1,
        tangible: true,
        externalRef: i.slug,
      })),
      shipping: {
        street: data.street,
        streetNumber: data.number,
        complement: data.complement ?? "",
        neighborhood: data.district,
        city: data.city,
        state: data.state,
        zipCode: digits(data.cep),
        country: "br",
        fee: data.shippingCents,
      },
      metadata: { pedido: order.id },
      postbackUrl,
    };

    let payload: SkaleTransaction;
    try {
      const response = await fetch(`${SKALE_BASE_URL}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify(body),
      });
      payload = (await response.json()) as SkaleTransaction;
      if (!response.ok || payload.success === false || !payload.pix?.qrcode) {
        console.error("skalepay create failed", response.status, payload);
        await supabaseAdmin
          .from("pix_orders")
          .update({ status: "failed", raw_response: payload as never })
          .eq("id", order.id);
        return {
          ok: false as const,
          error: payload.message ?? "O pagamento não pôde ser gerado. Tente novamente.",
        };
      }
    } catch (error) {
      console.error("skalepay create error", error);
      return { ok: false as const, error: "Falha de comunicação com o pagamento." };
    }

    await supabaseAdmin
      .from("pix_orders")
      .update({
        transaction_id: payload.id ?? null,
        status: payload.status ?? "waiting_payment",
        pix_qrcode: payload.pix?.qrcode ?? null,
        raw_response: payload as never,
      })
      .eq("id", order.id);

    const { syncOrderToUtmify } = await import("@/lib/utmify-orders.server");
    await syncOrderToUtmify(order.id);

    return {
      ok: true as const,
      orderId: order.id as string,
      amountCents: amount,
      pixCode: payload.pix.qrcode as string,
    };
  });

/** Consulta o status do pedido (usado pelo checkout para confirmar o pagamento). */
export const getPixOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("pix_orders")
      .select("status, transaction_id")
      .eq("id", data.orderId)
      .maybeSingle();

    if (!order) return { status: "not_found" as const };
    if (order.status === "paid") return { status: "paid" as const };

    // Fallback: consulta direta no gateway caso o aviso automático atrase.
    const apiKey = process.env["SKALEPAY_API_KEY"];
    if (apiKey && order.transaction_id) {
      try {
        const response = await fetch(`${SKALE_BASE_URL}/transactions/${order.transaction_id}`, {
          headers: { "X-API-Key": apiKey },
        });
        const payload = (await response.json()) as SkaleTransaction;
        if (response.ok && payload.status && payload.status !== order.status) {
          await supabaseAdmin
            .from("pix_orders")
            .update({
              status: payload.status,
              end_to_end_id: payload.pix?.end2EndId ?? null,
              paid_at: payload.status === "paid" ? new Date().toISOString() : null,
            })
            .eq("id", data.orderId);
          const { syncOrderToUtmify } = await import("@/lib/utmify-orders.server");
          await syncOrderToUtmify(data.orderId);
          return { status: payload.status };
        }
      } catch (error) {
        console.error("skalepay status error", error);
      }
    }

    // Reenvia à Utmify caso o primeiro envio tenha falhado.
    const { syncOrderToUtmify } = await import("@/lib/utmify-orders.server");
    await syncOrderToUtmify(data.orderId);

    return { status: order.status };
  });
