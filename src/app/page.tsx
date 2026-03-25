import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  hostnameFromRequestHeaders,
  isGuestLiveHostname,
} from "@/lib/liveGameHost";
import HomeClient from "@/app/HomeClient";

export default async function Home() {
  const h = await headers();
  const host = hostnameFromRequestHeaders(h);
  if (host && isGuestLiveHostname(host)) {
    redirect("/live");
  }
  return <HomeClient />;
}
