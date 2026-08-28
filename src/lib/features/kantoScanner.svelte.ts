import { appPath } from "@/lib/utils/appPath";
import type { KantoScannerAccess } from "@/lib/server/api/kantoAccess";

let access: KantoScannerAccess | null = $state(null);
let cooldownUntil = $state(0);
let center: [number, number] = $state([0, 0]);

export function getKantoScannerAccess() {
	return access;
}

export function getKantoScannerCooldownUntil() {
	return cooldownUntil;
}

export function setKantoScannerCooldown(seconds: number) {
	cooldownUntil = Date.now() + seconds * 1000;
}

export function getKantoScannerCenter() {
	return center;
}

export function setKantoScannerCenter(longitude: number, latitude: number) {
	center = [longitude, latitude];
}

export async function loadKantoScannerAccess() {
	const response = await fetch(appPath("/api/scanner"));
	if (response.status === 404) return;
	if (!response.ok) throw new Error(`scanner access ${response.status}`);
	const data = (await response.json()) as { access: KantoScannerAccess; retryAfter: number };
	access = data.access;
	setKantoScannerCooldown(data.retryAfter);
}
