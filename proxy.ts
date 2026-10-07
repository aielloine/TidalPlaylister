import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
  if (await getToken({ req })) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

// Tout est protégé sauf login, setup, l'API next-auth et les assets.
export const config = {
  matcher: ["/((?!login|setup|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
