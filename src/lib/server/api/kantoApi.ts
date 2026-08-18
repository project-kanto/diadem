import type { Bounds } from "@/lib/mapObjects/mapBounds";
import { type MapData, MapObjectType } from "@/lib/mapObjects/mapObjectTypes";
import type { MapObjectResponse } from "@/lib/server/queryMapObjects/MapObjectQuery";
import { getServerConfig } from "@/lib/services/config/config.server";
import type { GymData } from "@/lib/types/mapObjectData/gym";
import type { PokemonData } from "@/lib/types/mapObjectData/pokemon";
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
	expires_at?: string;
	capacity?: number;
	defenders?: KantoDefender[];
};

type KantoDefender = {
	pokemon_id: number;
	cp: number;
	deployed_at: string;
};

type KantoResponse = {
	features: KantoFeature[];
	truncated: boolean;
	updated_at: string;
};

const teamIds: Record<string, number> = { neutral: 0, mystic: 1, valor: 2, instinct: 3 };

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
		return {
			...common,
			pokemon_id: feature.pokemon_id ?? 0,
			atk_iv: attack,
			def_iv: defense,
			sta_iv: stamina,
			iv: hasIVs ? ((attack + defense + stamina) / 45) * 100 : undefined,
			form: 0,
			expire_timestamp: feature.expires_at
				? Math.floor(Date.parse(feature.expires_at) / 1000)
				: undefined,
			expire_timestamp_verified: true,
			first_seen_timestamp: updated,
			changed: updated,
			updated
		} as PokemonData;
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

	const url = new URL("api/map/v1/features", base.endsWith("/") ? base : base + "/");
	url.search = new URLSearchParams({
		south: String(bounds.minLat),
		west: String(bounds.minLon),
		north: String(bounds.maxLat),
		east: String(bounds.maxLon)
	}).toString();

	const response = await thisFetch(url);
	if (!response.ok) error(response.status, `Kanto API returned ${response.status}`);

	const source = (await response.json()) as KantoResponse;
	const updated = Math.floor(Date.parse(source.updated_at) / 1000);
	const features = source.features
		.filter((feature) => feature.kind === type)
		.slice(0, limit)
		.map((feature) => mapKantoFeature(feature, updated));

	return { data: features, examined: features.length };
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
