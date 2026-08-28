import type { Bounds } from "@/lib/mapObjects/mapBounds";
import { getServerConfig } from "@/lib/services/config/config.server";
import TTLCache from "@isaacs/ttlcache";

export type KantoScannerAccess = {
	subject: string;
	paid: boolean;
	state: {
		scanner_radius_meters: number;
		scanner_cooldown_seconds: number;
		scanner_expires_at?: string;
	};
};

export async function getKantoScannerAccess(cookie: string, thisFetch: typeof fetch) {
	const base = getServerConfig().kanto?.url;
	if (!base) return null;
	const response = await thisFetch(
		new URL("api/map/v1/access", base.endsWith("/") ? base : base + "/"),
		{ headers: { cookie }, cache: "no-store" }
	);
	if (!response.ok) return { response } as const;
	return { access: (await response.json()) as KantoScannerAccess } as const;
}

export function limitKantoBounds(bounds: Bounds, radiusMeters: number): Bounds {
	const centerLat = (bounds.minLat + bounds.maxLat) / 2;
	const centerLon = (bounds.minLon + bounds.maxLon) / 2;
	const latitudePad = radiusMeters / 111_320;
	const longitudePad =
		latitudePad / Math.max(Math.abs(Math.cos((centerLat * Math.PI) / 180)), 1e-6);
	return {
		minLat: Math.max(bounds.minLat, centerLat - latitudePad),
		maxLat: Math.min(bounds.maxLat, centerLat + latitudePad),
		minLon: Math.max(bounds.minLon, centerLon - longitudePad),
		maxLon: Math.min(bounds.maxLon, centerLon + longitudePad)
	};
}

const scanWindows = new TTLCache<string, { opened: number; latitude: number; longitude: number }>({
	ttl: 60 * 60 * 1000
});

export function getKantoScanRetryAfter(access: KantoScannerAccess, now = Date.now()) {
	const previous = scanWindows.get(access.subject);
	if (!previous) return 0;
	return Math.max(
		0,
		Math.ceil((access.state.scanner_cooldown_seconds * 1000 - (now - previous.opened)) / 1000)
	);
}

// Diadem requests each object family separately. Treat requests at the same centre during
// this short window as one scan, then enforce the advertised refresh cooldown.
export function claimKantoScan(access: KantoScannerAccess, bounds: Bounds, now = Date.now()) {
	const latitude = (bounds.minLat + bounds.maxLat) / 2;
	const longitude = (bounds.minLon + bounds.maxLon) / 2;
	const previous = scanWindows.get(access.subject);
	const cooldown = access.state.scanner_cooldown_seconds * 1000;
	if (previous && now - previous.opened < cooldown) {
		const sameBatch =
			now - previous.opened < 5000 &&
			Math.abs(previous.latitude - latitude) < 0.0001 &&
			Math.abs(previous.longitude - longitude) < 0.0001;
		return {
			allowed: sameBatch,
			retryAfter: Math.max(1, Math.ceil((cooldown - (now - previous.opened)) / 1000))
		};
	}
	scanWindows.set(access.subject, { opened: now, latitude, longitude });
	return { allowed: true, retryAfter: 0 };
}
