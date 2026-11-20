import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { booking_code } = await req.json();
    if (!booking_code) return new Response(JSON.stringify({error:"booking_code required"}), {status:400,headers:{...cors,"Content-Type":"application/json"}});

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const keyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    if (!keyId || !keySecret) throw new Error("Razorpay secrets are not configured");

    const admin = createClient(url, serviceKey);
    const {data: booking, error} = await admin.from("massage_bookings")
      .select("id, booking_code, total_amount, payment_method, payment_status")
      .eq("booking_code", booking_code).single();
    if (error || !booking) throw new Error("Booking not found");
    if (booking.payment_method !== "razorpay") throw new Error("Booking is not a Razorpay booking");
    if (booking.payment_status !== "payment_pending") throw new Error("Booking is not awaiting payment");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${keyId}:${keySecret}`),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: Number(booking.total_amount) * 100,
        currency: "INR",
        receipt: booking.booking_code,
        notes: {booking_id: booking.id, booking_code: booking.booking_code}
      })
    });
    const order = await response.json();
    if (!response.ok) throw new Error(order.error?.description || "Razorpay order creation failed");

    const {error: updateError} = await admin.from("massage_bookings")
      .update({razorpay_order_id: order.id})
      .eq("id", booking.id);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({
      order_id: order.id, amount: order.amount, currency: order.currency, key_id: keyId
    }), {headers:{...cors,"Content-Type":"application/json"}});
  } catch (e) {
    return new Response(JSON.stringify({error:e.message || "Unexpected error"}), {status:500,headers:{...cors,"Content-Type":"application/json"}});
  }
});
