import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const code = (await params).code.toLowerCase();
  const url = new URL("/", request.url);
  url.searchParams.set("ref", code);

  const response = NextResponse.redirect(url);
  response.cookies.set("ref", code, {
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
  });
  return response;
}
