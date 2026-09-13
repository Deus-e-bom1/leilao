import { createFileRoute } from "@tanstack/react-router";

const SKALE_BASE_URL = "https://api.skalepayments.com.br";

type Payload = {
  id?: string;
  status?: string;
  end2EndId?: string | null;
  metadata?: { pedido?: string } | null;
};

export const Route = createFileRoute("/api/public/skalepay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["SKALEPAY_API_KEY"];
        let payload: Payload;
        try {
          payload = (await request.json()) as Payload;
        } catch {
          return new Response("Invalid body", { status: 400 });
        }

        const transactionId = payload.id;
        const orderId = payload.metadata?.pedido;
        if (!transactionId || !orderId) return new Response("Missing data", { status: 400 });
        if (!apiKey) return new Response("Not configured", { status: 500 });

        // Nunca confiamos no corpo recebido: confirmamos o status na própria API.
        let status: string | undefined;
        let endToEndId: string | null = null;
        try {
          const response = await fetch(`${SKALE_BASE_URL}/transactions/${transactionId}`, {
            headers: { "X-API-Key": apiKey },
          });
          if (!response.ok) return new Response("Unverified", { status: 401 });
          const verified = (await response.json()) as {
            status?: string;
            pix?: { end2EndId?: string | null } | null;
          };
          status = verified.status;
          endToEndId = verified.pix?.end2EndId ?? null;
        } catch (error) {
          console.error("skalepay webhook verify error", error);
          return new Response("Verification failed", { status: 500 });
        }

        if (!status) return new Response("No status", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("pix_orders")
          .update({
            status,
            transaction_id: transactionId,
            end_to_end_id: endToEndId,
            paid_at: status === "paid" ? new Date().toISOString() : null,
          })
          .eq("id", orderId);

        if (error) {
          console.error("skalepay webhook update failed", error);
          return new Response("Update failed", { status: 500 });
        }

        const { syncOrderToUtmify } = await import("@/lib/utmify-orders.server");
        await syncOrderToUtmify(orderId);

        return new Response("ok");
      },
    },
  },
});
