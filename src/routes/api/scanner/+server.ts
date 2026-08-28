import { claimKantoScan, getKantoScanRetryAfter } from "@/lib/server/api/kantoAccess";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

function getAccess(access: App.Locals["kantoScannerAccess"]) {
	if (!access) error(404);
	return access;
}

export const GET: RequestHandler = ({ locals }) => {
	const access = getAccess(locals.kantoScannerAccess);
	return json({ access, retryAfter: getKantoScanRetryAfter(access) });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const access = getAccess(locals.kantoScannerAccess);
	const bounds = await request.json().catch(() => error(400, "Invalid scan area"));
	if (
		!bounds ||
		![bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon].every(Number.isFinite) ||
		bounds.minLat >= bounds.maxLat ||
		bounds.minLon >= bounds.maxLon
	) {
		error(400, "Invalid scan area");
	}

	const scan = claimKantoScan(access, bounds);
	if (!scan.allowed) {
		return json(
			{ retryAfter: scan.retryAfter },
			{ status: 429, headers: { "Retry-After": String(scan.retryAfter) } }
		);
	}
	return json({ retryAfter: access.state.scanner_cooldown_seconds });
};
