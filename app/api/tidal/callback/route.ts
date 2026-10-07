import { NextResponse, type NextRequest } from "next/server";
import { completeAuthorization } from "@/lib/tidal";

export async function GET(req: NextRequest) {
  const back = (msg: string) => {
    const res = NextResponse.redirect(new URL(`/?tidal=${encodeURIComponent(msg)}`, process.env.NEXTAUTH_URL));
    res.cookies.delete({ name: "tidal_oauth", path: "/api/tidal/callback" });
    return res;
  };
  const p = req.nextUrl.searchParams;
  const saved = JSON.parse(req.cookies.get("tidal_oauth")?.value ?? "{}");
  if (p.get("error")) return back(`Refusé par Tidal : ${p.get("error_description") ?? p.get("error")}`);
  if (!p.get("code") || !saved.state || p.get("state") !== saved.state) return back("État OAuth invalide, réessayez");
  try {
    await completeAuthorization(p.get("code")!, saved.verifier);
    return back("ok");
  } catch (e) {
    console.error(e);
    return back((e as Error).message);
  }
}
