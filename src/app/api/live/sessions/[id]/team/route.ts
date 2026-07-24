import { NextRequest, NextResponse } from "next/server";
import { selectLiveTeam } from "@/lib/live-game/service";
import { liveErrorResponse } from "@/lib/live-game/http";

// POST /api/live/sessions/:id/team — player picks a team in the lobby.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { team?: unknown };
    const team = typeof body.team === "string" ? body.team : "";
    const result = await selectLiveTeam(
      id,
      request.headers.get("authorization"),
      team,
    );
    return NextResponse.json(result);
  } catch (error) {
    return liveErrorResponse(error);
  }
}
