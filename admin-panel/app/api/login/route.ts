import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL!;
const ADMIN_PREFIX = process.env.ADMIN_PREFIX!;

export async function POST(req: NextRequest) {
  const body = await req.json();

  const res = await fetch(`${API_URL}/${ADMIN_PREFIX}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { detail: data.detail || "Login failed" },
      { status: res.status }
    );
  }

  return NextResponse.json(data);
}