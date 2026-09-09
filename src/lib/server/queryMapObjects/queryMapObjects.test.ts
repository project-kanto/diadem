import { describe, expect, it, vi } from "vitest";
import { MapObjectType } from "@/lib/mapObjects/mapObjectTypes";
import type { FilterPokemon } from "@/lib/features/filters/filters";
import { queryMapObjects } from "./queryMapObjects";

vi.mock("@/lib/services/config/config.server", () => ({
	getServerConfig: () => ({ kanto: { url: "https://test.invalid/" } })
}));
vi.mock("@/lib/server/db/external/internalQuery", () => ({ query: vi.fn() }));
vi.mock("@/lib/mapObjects/currentSelectedState.svelte", () => ({
	isCurrentSelectedOverwrite: () => false
}));
vi.mock("@/lib/services/userSettings.svelte", () => ({ getUserSettings: () => ({}) }));
vi.mock("@/lib/server/api/kantoApi", () => ({
	queryKantoMapObject: vi.fn(),
	queryKantoMapObjects: vi.fn(async () => ({
		examined: 3,
		data: [
			{ id: "normal", pokemon_id: 25, form: 0, shiny: false, cp: 100 },
			{ id: "shiny", pokemon_id: 25, form: 0, shiny: true, cp: 200 },
			{ id: "other", pokemon_id: 54, form: 0, shiny: true, cp: 300 }
		]
	}))
}));

describe("Kanto scan filtering", () => {
	it("applies the actual query path's shiny, species, CP and disabled filters", async () => {
		const bounds = { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 };
		for (const [settings, ids] of [
			[{ shiny: true }, ["shiny", "other"]],
			[{ shiny: false }, ["normal"]],
			[{ shiny: true, pokemon: [{ pokemon_id: 25, form: 0 }] }, ["shiny"]],
			[{ cp: { min: 250, max: 400 } }, ["other"]],
			[{}, ["normal", "shiny", "other"]]
		] as const) {
			const filter = { enabled: true, filters: [{ enabled: true, ...settings }] } as FilterPokemon;
			const result = await queryMapObjects(MapObjectType.POKEMON, bounds, filter);
			expect(result.data.map((p) => p.id)).toEqual(ids);
		}
		expect(
			(await queryMapObjects(MapObjectType.POKEMON, bounds, { enabled: false } as FilterPokemon))
				.data
		).toEqual([]);
	});
});

vi.mock("./queryGym", () => ({ GymQuery: class {} }));
vi.mock("./queryNest", () => ({ NestQuery: class {} }));
vi.mock("./queryPokestop", () => ({ PokestopQuery: class {} }));
vi.mock("./queryRoute", () => ({ RouteQuery: class {} }));
vi.mock("./querySpawnpoint", () => ({ SpawnpointQuery: class {} }));
vi.mock("./queryStation", () => ({ StationQuery: class {} }));
vi.mock("./queryTappable", () => ({ TappableQuery: class {} }));
vi.mock("@/lib/utils/pokemonUtils", () => ({
	getBestRank: () => undefined,
	League: {},
	getNormalizedForm: () => 0,
	showPvp: () => false
}));
vi.mock("@/lib/services/masterfile", () => ({ getMasterPokemon: () => ({}) }));
