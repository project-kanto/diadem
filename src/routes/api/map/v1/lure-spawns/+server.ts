import { proxyKantoLureSpawns } from "@/lib/server/api/kantoApi";
import type { RequestHandler } from "./$types";

// Keep the original Kanto laboratory's relative live-lure URL working when an
// already-open map crosses over to Diadem at the /map base path.
export const GET: RequestHandler = ({ fetch, url }) => proxyKantoLureSpawns(url, fetch);
