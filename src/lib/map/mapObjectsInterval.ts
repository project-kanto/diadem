import {
	UPDATE_MAP_OBJECT_INTERVAL_MAX_ZOOM,
	UPDATE_MAP_OBJECT_INTERVAL_TIME
} from "@/lib/constants";
import { getMap } from "@/lib/map/map.svelte";
import { updateAllMapObjects } from "@/lib/mapObjects/updateMapObject";
import { getKantoScannerAccess } from "@/lib/features/kantoScanner.svelte";

let updateMapObjectsInterval: undefined | NodeJS.Timeout = undefined;

export function clearUpdateMapObjectsInterval() {
	if (updateMapObjectsInterval) clearInterval(updateMapObjectsInterval);
	updateMapObjectsInterval = undefined;
}

export function resetUpdateMapObjectsInterval() {
	if (getKantoScannerAccess()) return;
	const map = getMap();
	if (!map) return;
	if (map.getZoom() < UPDATE_MAP_OBJECT_INTERVAL_MAX_ZOOM) return;
	clearUpdateMapObjectsInterval();
	updateMapObjectsInterval = setInterval(
		() => updateAllMapObjects(true, true),
		UPDATE_MAP_OBJECT_INTERVAL_TIME
	);
}
