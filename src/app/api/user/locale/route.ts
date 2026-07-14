import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";
import { isLocale } from "@/i18n/types";

export async function PATCH(request: NextRequest) {
  const token = request.cookies.get("auth")?.value;
  const payload = await verifyAuthToken(token);

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json();
  const { locale } = body as { locale?: string };

  if (!isLocale(locale)) {
    return NextResponse.json(
      { error: "Invalid locale", code: "INVALID_REQUEST_FORMAT" },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { id: payload.userId },
    data: { locale },
    select: {
      id: true,
      email: true,
      nickname: true,
      locale: true,
      createdAt: true,
    },
  });

  const res = NextResponse.json({ user });
  res.cookies.set("locale", locale, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
