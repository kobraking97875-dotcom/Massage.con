import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const {booking_code, razorpay_order_id, razorpay_payment_id, razorpay_signature} = await req.json();
    if (!booking_code || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(JSON.stringify({error:"Missing payment verification fields"}), {status:400,headers:{...cors,"Content-Type":"application/json"}});
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const {data: booking, error} = await admin.from("massage_bookings")
      .select("id, booking_code, total_amount, razorpay_order_id, payment_method, payment_status")
      .eq("booking_code", booking_code).single();
    if (error || !booking) throw new Error("Booking not found");
    if (booking.payment_method !== "razorpay" || booking.razorpay_order_id !== razorpay_order_id) {
      throw new Error("Order does not match this booking");
    }

    const secret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret), {name:"HMAC", hash:"SHA-256"}, false, ["sign"]
    );
    const signature = await crypto.subtle.sign(
      "HMAC", key, new TextEncoder().encode(`${razorpay_order_id}|${razorpay_payment_id}`)
    );
    const expected = hex(signature);
    if (expected !== razorpay_signature) throw new Error("Payment signature verification failed");

    // Verify status with Razorpay server before marking paid.
    const keyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: {"Authorization":"Basic " + btoa(`${keyId}:${secret}`)}
    });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok || payment.order_id !== razorpay_order_id ||
        payment.status !== "captured" || payment.currency !== "INR" || Number(payment.amount) !== Number(booking.total_amount) * 100) {
      throw new Error("Razorpay payment is not captured yet");
    }

    const {error: updateError} = await admin.from("massage_bookings").update({
      payment_status:"paid", status:"confirmed",
      razorpay_payment_id, razorpay_signature
    }).eq("id", booking.id);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({verified:true, booking_code:booking.booking_code}), {headers:{...cors,"Content-Type":"application/json"}});
  } catch (e) {
    return new Response(JSON.stringify({error:e.message || "Unexpected error"}), {status:400,headers:{...cors,"Content-Type":"application/json"}});
  }
});
