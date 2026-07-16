import { NextRequest } from "next/server";
import { redirectSharedAuthPost } from "@/lib/sharedAuthRedirect";

export const runtime = "nodejs";

export function POST(request: NextRequest) {
  return redirectSharedAuthPost(request, "/auth/reset-password");
}
