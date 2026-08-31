<script lang="ts">
	import Button from "@/components/ui/input/Button.svelte";
	import {
		getKantoScannerAccess,
		getKantoScannerCooldownUntil,
		setKantoScannerCooldown
	} from "@/lib/features/kantoScanner.svelte";
	import { getBounds } from "@/lib/mapObjects/mapBounds";
	import { getMapObjectCounts } from "@/lib/mapObjects/mapObjectsState.svelte";
	import { allMapObjectTypes } from "@/lib/mapObjects/mapObjectTypes";
	import { updateAllMapObjects } from "@/lib/mapObjects/updateMapObject";
	import * as m from "@/lib/paraglide/messages";
	import { appPath } from "@/lib/utils/appPath";
	import { ScanLine } from "@lucide/svelte";
	import { onMount } from "svelte";

	let now = $state(Date.now());
	let scanning = $state(false);
	let failed = $state(false);
	let scanResult = $state<number | null>(null);
	const access = $derived(getKantoScannerAccess());
	const remaining = $derived(Math.max(0, Math.ceil((getKantoScannerCooldownUntil() - now) / 1000)));
	const scanArea = $derived(
		access?.unlimited
			? m.scanner_current_view()
			: m.scanner_radius({
					distance:
						access && access.state.scanner_radius_meters >= 1000
							? `${access.state.scanner_radius_meters / 1000} km`
							: `${access?.state.scanner_radius_meters ?? 0} m`
				})
	);
	const accessExpiry = $derived(
		access?.paid ? access.state.active_until : access?.state.scanner_expires_at
	);
	const accessRemaining = $derived(
		accessExpiry ? Math.max(0, Math.ceil((Date.parse(accessExpiry) - now) / 1000)) : undefined
	);
	const accessTime = $derived.by(() => {
		if (accessRemaining === undefined) return "";
		const days = Math.floor(accessRemaining / 86_400);
		const hours = Math.floor((accessRemaining % 86_400) / 3600);
		const minutes = Math.floor((accessRemaining % 3600) / 60);
		const seconds = accessRemaining % 60;
		if (days) return `${days}d ${hours}h`;
		if (hours) return `${hours}h ${minutes}m`;
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	});
	const accessStatus = $derived(
		access?.unlimited
			? m.scanner_admin_access()
			: accessRemaining === 0
				? m.scanner_access_expired()
				: access?.paid
					? m.scanner_membership_access({
							tier: access.state.tier === "charizard" ? "Charizard" : "Pikachu",
							time: accessTime
						})
					: m.scanner_offer_access({ time: accessTime })
	);

	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});
</script>

{#if access}
	<div class="pointer-events-auto w-52 rounded-lg border bg-card p-3 shadow-lg">
		<div class="mb-2 flex items-center justify-between gap-3 text-sm">
			<span class="font-semibold">{m.scanner_title()}</span>
			<span class="text-muted-foreground">{scanArea}</span>
		</div>
		<div class="mb-2 text-xs text-muted-foreground" aria-live="polite">{accessStatus}</div>
		<Button
			class="w-full"
			disabled={scanning || remaining > 0 || accessRemaining === 0}
			onclick={async () => {
				scanning = true;
				failed = false;
				scanResult = null;
				try {
					const response = await fetch(appPath("/api/scanner"), {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(getBounds())
					});
					const data = (await response.json()) as { retryAfter?: number };
					if (!response.ok && response.status !== 429) throw new Error(`scan ${response.status}`);
					setKantoScannerCooldown(data.retryAfter ?? Number(response.headers.get("Retry-After")));
					now = Date.now();
					if (response.ok) {
						await updateAllMapObjects(false, false, true);
						scanResult = allMapObjectTypes.reduce(
							(total, type) => total + getMapObjectCounts(type).showing,
							0
						);
					}
				} catch {
					failed = true;
				} finally {
					scanning = false;
				}
			}}
		>
			<ScanLine class="size-4" />
			{scanning
				? m.scanner_scanning()
				: remaining > 0
					? m.scanner_ready_in({ seconds: remaining })
					: access.unlimited
						? m.scanner_scan_visible_area()
						: m.scanner_scan_area()}
		</Button>
		<div class="mt-1.5 min-h-4 text-center text-xs text-muted-foreground" aria-live="polite">
			{failed
				? m.scanner_failed()
				: scanResult === 0
					? m.scanner_no_results({ area: scanArea })
					: scanResult !== null
						? m.scanner_results({ count: scanResult })
						: remaining === 0 && !scanning
							? m.scanner_ready()
							: ""}
		</div>
	</div>
{/if}
