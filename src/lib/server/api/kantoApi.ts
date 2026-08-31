import type { Bounds } from "@/lib/mapObjects/mapBounds";
import { type MapData, MapObjectType } from "@/lib/mapObjects/mapObjectTypes";
import type { MapObjectResponse } from "@/lib/server/queryMapObjects/MapObjectQuery";
import { getServerConfig } from "@/lib/services/config/config.server";
import type { GymData } from "@/lib/types/mapObjectData/gym";
import type { NestData } from "@/lib/types/mapObjectData/nest";
import type { PokemonData, PokemonRarity } from "@/lib/types/mapObjectData/pokemon";
import type { PokestopData } from "@/lib/types/mapObjectData/pokestop";
import { error } from "@sveltejs/kit";

type KantoFeature = {
	id: string;
	kind: "pokemon" | "nest" | "pokestop" | "gym";
	latitude: number;
	longitude: number;
	name?: string;
	team?: string;
	prestige?: number;
	pokemon_id?: number;
	attack_iv?: number;
	defense_iv?: number;
	stamina_iv?: number;
	move_1?: number;
	move_2?: number;
	height_m?: number;
	weight_kg?: number;
	source?: string;
	rarity?: PokemonRarity;
	chance_percent?: number;
	nest_chance?: number;
	spawnpoints?: number;
	geometry?: KantoGeometry;
	spawned_at?: string;
	expires_at?: string;
	capacity?: number;
	defenders?: KantoDefender[];
};

type KantoGeometry =
	| { type: "Polygon"; coordinates: number[][][] }
	| { type: "MultiPolygon"; coordinates: number[][][][] };

type KantoResponse = {
	features: KantoFeature[];
	truncated: boolean;
	updated_at: string;
};

type KantoDefender = {
	pokemon_id: number;
	cp: number;
	deployed_at: string;
};

const teamIds: Record<string, number> = { neutral: 0, mystic: 1, valor: 2, instinct: 3 };

function kantoURL(base: string, path: string, bounds?: Bounds): URL {
	const url = new URL(path, base.endsWith("/") ? base : base + "/");
	if (bounds) {
		url.search = new URLSearchParams({
			south: String(bounds.minLat),
			west: String(bounds.minLon),
			north: String(bounds.maxLat),
			east: String(bounds.maxLon)
		}).toString();
	}
	return url;
}

function mapKantoGeometry(geometry?: KantoGeometry): NestData["polygon"] {
	if (!geometry) return;
	if (geometry.type === "Polygon") {
		return geometry.coordinates.map((ring) => ring.map(([x, y]) => ({ x, y })));
	}
	return geometry.coordinates.map((polygon) =>
		polygon.map((ring) => ring.map(([x, y]) => ({ x, y })))
	);
}

function mapKantoFeature(feature: KantoFeature, updated: number): MapData {
	const type = feature.kind as MapObjectType;
	const common = {
		id: feature.id,
		mapId: `${type}-${feature.id}`,
		type,
		lat: feature.latitude,
		lon: feature.longitude
	};
	if (type === MapObjectType.POKEMON) {
		const attack = feature.attack_iv;
		const defense = feature.defense_iv;
		const stamina = feature.stamina_iv;
		const hasIVs = attack != null && defense != null && stamina != null;
		const spawned = feature.spawned_at
			? Math.floor(Date.parse(feature.spawned_at) / 1000)
			: updated;
		return {
			...common,
			pokemon_id: feature.pokemon_id ?? 0,
			atk_iv: attack,
			def_iv: defense,
			sta_iv: stamina,
			iv: hasIVs ? ((attack + defense + stamina) / 45) * 100 : undefined,
			move_1: feature.move_1,
			move_2: feature.move_2,
			height: feature.height_m,
			weight: feature.weight_kg,
			rarity: feature.rarity,
			seen_type: feature.source === "lure" ? "lure_wild" : "wild",
			form: 0,
			expire_timestamp: feature.expires_at
				? Math.floor(Date.parse(feature.expires_at) / 1000)
				: undefined,
			expire_timestamp_verified: true,
			first_seen_timestamp: spawned,
			changed: spawned,
			updated: spawned
		} as PokemonData;
	}
	if (type === MapObjectType.NEST) {
		const chance = feature.nest_chance ?? 0;
		return {
			...common,
			name: feature.name ?? null,
			area_name: feature.name ?? null,
			polygon: mapKantoGeometry(feature.geometry),
			spawnpoints: feature.spawnpoints ?? null,
			m2: null,
			active: 1,
			pokemon_id: feature.pokemon_id ?? null,
			form: 0,
			pokemon_avg: feature.spawnpoints != null ? (feature.spawnpoints * chance) / 100 : null,
			pokemon_ratio: chance || null,
			pokemon_count: null,
			discarded: null,
			updated
		} as NestData;
	}
	if (type === MapObjectType.POKESTOP) {
		return {
			...common,
			name: feature.name,
			incident: [],
			quests: [],
			updated,
			first_seen_timestamp: updated,
			deleted: 0
		} as PokestopData;
	}

	const defenders = (feature.defenders ?? []).map((defender) => {
		const deployed = Math.floor(Date.parse(defender.deployed_at) / 1000);
		return {
			pokemon_id: defender.pokemon_id,
			form: 0,
			gender: 0,
			shiny: false,
			deployed_ms: deployed * 1000,
			deployed_time: deployed,
			battles_won: 0,
			battles_lost: 0,
			times_fed: 0,
			motivation_now: 1,
			cp_now: defender.cp,
			cp_when_deployed: defender.cp
		};
	});
	const totalSlots = feature.capacity ?? 6;
	return {
		...common,
		name: feature.name,
		team_id: teamIds[feature.team ?? "neutral"] ?? 0,
		total_cp: feature.prestige,
		total_slots: totalSlots,
		availble_slots: Math.max(0, totalSlots - defenders.length),
		guarding_pokemon_id: defenders.at(-1)?.pokemon_id,
		defenders,
		updated,
		first_seen_timestamp: updated,
		deleted: 0
	} as GymData;
}

export async function queryKantoMapObjects(
	type: MapObjectType,
	bounds: Bounds,
	limit: number,
	thisFetch: typeof fetch = fetch
): Promise<MapObjectResponse<MapData>> {
	const base = getServerConfig().kanto?.url;
	if (!base) error(500, "Kanto API is not configured");

	const url = kantoURL(base, "api/map/v1/features", bounds);
	if (type === MapObjectType.POKEMON || type === MapObjectType.NEST) {
		url.searchParams.set("pokemon", "1");
	} else if (type === MapObjectType.POKESTOP || type === MapObjectType.GYM) {
		url.searchParams.set("forts", "1");
	}
	const response = await thisFetch(url);
	if (!response.ok) error(response.status, `Kanto API returned ${response.status}`);

	const source = (await response.json()) as KantoResponse;
	if (source.truncated) error(503, "Kanto API result was truncated");
	if (type === MapObjectType.POKEMON) {
		const lureResponse = await thisFetch(kantoURL(base, "api/map/v1/lure-spawns", bounds), {
			cache: "no-store"
		});
		if (!lureResponse.ok)
			error(lureResponse.status, `Kanto lure API returned ${lureResponse.status}`);
		const lures = (await lureResponse.json()) as KantoResponse;
		const known = new Set(source.features.map(({ id }) => id));
		source.features.push(...lures.features.filter(({ id }) => !known.has(id)));
	}
	const updated = Math.floor(Date.parse(source.updated_at) / 1000);
	const features = source.features
		.filter((feature) => feature.kind === type)
		.slice(0, limit)
		.map((feature) => mapKantoFeature(feature, updated));

	return { data: features, examined: features.length };
}

export async function proxyKantoLureSpawns(
	requestURL: URL,
	thisFetch: typeof fetch = fetch
): Promise<Response> {
	const base = getServerConfig().kanto?.url;
	if (!base) error(500, "Kanto API is not configured");

	const url = kantoURL(base, "api/map/v1/lure-spawns");
	url.search = requestURL.search;
	return thisFetch(url, { cache: "no-store" });
}

export async function queryKantoSpecies(
	thisFetch: typeof fetch = fetch
): Promise<{ pokemon_id: number; form: number }[]> {
	const base = getServerConfig().kanto?.url;
	if (!base) error(500, "Kanto API is not configured");

	const response = await thisFetch(kantoURL(base, "api/map/v1/species"));
	if (!response.ok) error(response.status, `Kanto species API returned ${response.status}`);
	const species = (await response.json()) as { id: number }[];
	return species.map(({ id }) => ({ pokemon_id: id, form: 0 }));
}

export async function queryKantoMapObject(
	type: MapObjectType,
	id: string,
	thisFetch: typeof fetch = fetch
): Promise<MapData | undefined> {
	const base = getServerConfig().kanto?.url;
	if (!base) error(500, "Kanto API is not configured");

	const url = new URL(
		`api/map/v1/features/${encodeURIComponent(id)}`,
		base.endsWith("/") ? base : base + "/"
	);
	const response = await thisFetch(url);
	if (response.status === 404) return;
	if (!response.ok) error(response.status, `Kanto API returned ${response.status}`);

	const source = (await response.json()) as { feature: KantoFeature; updated_at: string };
	if (source.feature.kind !== type) return;
	return mapKantoFeature(source.feature, Math.floor(Date.parse(source.updated_at) / 1000));
}
