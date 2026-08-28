import { describe, expect, it } from "vitest";
import {
	claimKantoScan,
	getKantoScanRetryAfter,
	limitKantoBounds,
	type KantoScannerAccess
} from "./kantoAccess";

describe("limitKantoBounds", () => {
	it("limits a large viewport around its requested centre", () => {
		const bounds = limitKantoBounds({ minLat: 50, maxLat: 52, minLon: -1, maxLon: 1 }, 500);
		expect(bounds.maxLat - bounds.minLat).toBeCloseTo(1000 / 111_320, 6);
		expect((bounds.minLat + bounds.maxLat) / 2).toBeCloseTo(51, 8);
	});

	it("groups one map refresh then enforces the supporter cooldown", () => {
		const access = {
			subject: "cooldown-test",
			paid: true,
			state: { scanner_radius_meters: 500, scanner_cooldown_seconds: 15 }
		} satisfies KantoScannerAccess;
		const bounds = { minLat: 50, maxLat: 50.01, minLon: -1, maxLon: -0.99 };
		expect(claimKantoScan(access, bounds, 1000).allowed).toBe(true);
		expect(getKantoScanRetryAfter(access, 2000)).toBe(14);
		expect(claimKantoScan(access, bounds, 2000).allowed).toBe(true);
		expect(claimKantoScan(access, { ...bounds, minLat: 51 }, 3000).allowed).toBe(false);
		expect(claimKantoScan(access, bounds, 16_000).allowed).toBe(true);
	});
});
