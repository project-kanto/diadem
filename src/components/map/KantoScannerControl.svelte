<script lang="ts">
	import Button from "@/components/ui/input/Button.svelte";
	import {
		getKantoScannerAccess,
		getKantoScannerCooldownUntil,
		setKantoScannerCooldown
	} from "@/lib/features/kantoScanner.svelte";
	import { getBounds } from "@/lib/mapObjects/mapBounds";
	import { updateAllMapObjects } from "@/lib/mapObjects/updateMapObject";
	import * as m from "@/lib/paraglide/messages";
	import { appPath } from "@/lib/utils/appPath";
	import { ScanLine } from "@lucide/svelte";
	import { onMount } from "svelte";

	let now = $state(Date.now());
	let scanning = $state(false);
	let failed = $state(false);
	const access = $derived(getKantoScannerAccess());
	const remaining = $derived(Math.max(0, Math.ceil((getKantoScannerCooldownUntil() - now) / 1000)));
	const radius = $derived(
		access && access.state.scanner_radius_meters >= 1000
			? `${access.state.scanner_radius_meters / 1000} km`
			: `${access?.state.scanner_radius_meters ?? 0} m`
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
			<span class="text-muted-foreground">{radius}</span>
		</div>
		<Button
			class="w-full"
			disabled={scanning || remaining > 0}
			onclick={async () => {
				scanning = true;
				failed = false;
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
					if (response.ok) await updateAllMapObjects(false, false, true);
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
					: m.scanner_scan_area()}
		</Button>
		<div class="mt-1.5 min-h-4 text-center text-xs text-muted-foreground" aria-live="polite">
			{failed ? m.scanner_failed() : remaining === 0 && !scanning ? m.scanner_ready() : ""}
		</div>
	</div>
{/if}
