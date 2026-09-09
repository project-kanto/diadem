import { describe, it, expect } from "vitest";
import { sealScannerSession, openScannerSession } from "./launcherScanner";

describe("launcher scanner session", () => {
	it("is opaque, scoped, authenticated, short-lived and never accepts a raw login token", () => {
		const secret = "a".repeat(32),
			login = "b".repeat(64),
			audience = "http://dev/map-api/",
			now = 1700000000000;
		const { token, expires_at } = sealScannerSession(login, secret, audience, now);
		expect(token).not.toContain(login);
		expect(expires_at).toBe(now / 1000 + 300);
		expect(openScannerSession(token, secret, audience, now)).toBe(login);
		expect(openScannerSession(token, secret, audience, now + 300000)).toBeNull();
		expect(openScannerSession(token, secret, "http://live/map-api/", now)).toBeNull();
		expect(openScannerSession(token, "c".repeat(32), audience, now)).toBeNull();
		const wire = Buffer.from(token, "base64url");
		wire[30] ^= 1;
		expect(openScannerSession(wire.toString("base64url"), secret, audience, now)).toBeNull();
		expect(openScannerSession(login, secret, audience, now)).toBeNull();
		expect(() => sealScannerSession(login, "", audience, now)).toThrow();
	});
});
