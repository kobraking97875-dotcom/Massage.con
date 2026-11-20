import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:cors});
  try {
    const {booking_code, utr} = await req.json();
    if (!booking_code || !/^[A-Za-z0-9-]{8,40}$/.test(utr || "")) {
      return new Response(JSON.stringify({error:"Enter a valid UTR/reference number"}), {status:400,headers:{...cors,"Content-Type":"application/json"}});
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const {data: booking, error} = await admin.from("massage_bookings")
      .select("id, booking_code, payment_method, payment_status")
      .eq("booking_code", booking_code).single();
    if (error || !booking) throw new Error("Booking not found");
    if (booking.payment_method !== "upi_qr") throw new Error("Booking is not a UPI QR booking");
    const {error:updateError} = await admin.from("massage_bookings").update({
      upi_reference: utr, payment_status: "verification_pending"
    }).eq("id", booking.id);
    if (updateError) throw updateError;
    return new Response(JSON.stringify({submitted:true, booking_code:booking.booking_code, message:"Awaiting manual payment verification"}), {headers:{...cors,"Content-Type":"application/json"}});
  } catch(e) {
    return new Response(JSON.stringify({error:e.message || "Unexpected error"}), {status:400,headers:{...cors,"Content-Type":"application/json"}});
  }
});
