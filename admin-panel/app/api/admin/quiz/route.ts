import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL!;

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization") || "";

  const res = await fetch(`${API_URL}/admin/quiz`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization") || "";
  const body = await req.json();

  const res = await fetch(`${API_URL}/admin/quiz`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}