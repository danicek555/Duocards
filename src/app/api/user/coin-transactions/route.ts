import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transactions = await prisma.coinTransaction.findMany({
      where: { userId: payload.userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
      select: {
        id: true,
        amount: true,
        balanceAfter: true,
        type: true,
        referenceId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ transactions }, { status: 200 });
  } catch (error) {
    console.error("Error fetching coin transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch coin transactions" },
      { status: 500 },
    );
  }
}
