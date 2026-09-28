import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/server/adminSession";

export async function GET(req: Request) {
  const email = adminFromRequest(req);
  return email ? NextResponse.json({ email }) : NextResponse.json({ email: null }, { status: 401 });
}
