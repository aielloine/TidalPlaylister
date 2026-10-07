import { NextResponse } from "next/server";
import { startAuthorization } from "@/lib/tidal";

export async function GET() {
  const { url, verifier, state } = startAuthorization();
  const res = NextResponse.redirect(url);
  res.cookies.set("tidal_oauth", JSON.stringify({ verifier, state }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/tidal/callback",
    maxAge: 600,
  });
  return res;
}
