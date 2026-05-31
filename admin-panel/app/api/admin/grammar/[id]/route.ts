import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL!;

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization") || "";
  const { id } = await params;

  const res = await fetch(`${API_URL}/admin/grammar/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}