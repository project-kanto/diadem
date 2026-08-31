import { describe, expect, it, vi } from "vitest";
import { MapObjectType } from "@/lib/mapObjects/mapObjectTypes";
import {
	proxyKantoLureSpawns,
	queryKantoMapObject,
	queryKantoMapObjects,
	queryKantoSpecies
} from "./kantoApi";

vi.mock("@/lib/services/config/config.server", () => ({
	getServerConfig: () => ({ kanto: { url: "https://dev.kanto.ac/map/" } })
}));

describe("queryKantoMapObjects", () => {
	it("loads Kanto's authoritative spawnable species", async () => {
		const mockFetch = vi.fn(
			async () => new Response(JSON.stringify([{ id: 1 }, { id: 25 }]))
		) as unknown as typeof fetch;

		await expect(queryKantoSpecies(mockFetch)).resolves.toEqual([
			{ pokemon_id: 1, form: 0 },
			{ pokemon_id: 25, form: 0 }
		]);
		expect(mockFetch).toHaveBeenCalledWith(new URL("https://dev.kanto.ac/map/api/map/v1/species"));
	});

	it("maps Kanto features into Diadem objects", async () => {
		const fetchSpy = vi.fn(async (url: URL | RequestInfo) => {
			if (String(url).includes("lure-spawns")) {
				return new Response(
					JSON.stringify({
						updated_at: "2026-08-17T20:00:01Z",
						truncated: false,
						features: [
							{
								id: "lure-1",
								kind: "pokemon",
								latitude: 52.51,
								longitude: -0.71,
								pokemon_id: 133,
								source: "lure",
								spawned_at: "2026-08-17T19:59:30Z",
								expires_at: "2026-08-17T20:04:00Z"
							}
						]
					})
				);
			}
			return new Response(
				JSON.stringify({
					updated_at: "2026-08-17T20:00:00Z",
					truncated: false,
					features: [
						{
							id: "spawn-1",
							kind: "pokemon",
							latitude: 52.5,
							longitude: -0.7,
							pokemon_id: 25,
							attack_iv: 15,
							defense_iv: 14,
							stamina_iv: 13,
							move_1: 13,
							move_2: 14,
							height_m: 0.42,
							weight_kg: 6.1,
							rarity: "rare",
							spawned_at: "2026-08-17T19:55:00Z",
							expires_at: "2026-08-17T20:05:00Z"
						},
						{
							id: "gym-1",
							kind: "gym",
							latitude: 52.51,
							longitude: -0.71,
							capacity: 3,
							defenders: [{ pokemon_id: 25, cp: 500, deployed_at: "2026-08-17T19:00:00Z" }]
						}
					]
				})
			);
		});
		const mockFetch = fetchSpy as unknown as typeof fetch;

		const result = await queryKantoMapObjects(
			MapObjectType.POKEMON,
			{ minLat: 52.4, minLon: -0.8, maxLat: 52.6, maxLon: -0.6 },
			100,
			mockFetch
		);

		expect(result.data).toEqual([
			expect.objectContaining({
				id: "spawn-1",
				mapId: "pokemon-spawn-1",
				pokemon_id: 25,
				atk_iv: 15,
				def_iv: 14,
				sta_iv: 13,
				iv: (42 / 45) * 100,
				expire_timestamp: 1786997100,
				expire_timestamp_verified: true,
				move_1: 13,
				move_2: 14,
				height: 0.42,
				weight: 6.1,
				rarity: "rare",
				seen_type: "wild",
				first_seen_timestamp: 1786996500,
				changed: 1786996500
			}),
			expect.objectContaining({
				id: "lure-1",
				pokemon_id: 133,
				seen_type: "lure_wild",
				first_seen_timestamp: 1786996770
			})
		]);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(fetchSpy.mock.calls[0][0]).toEqual(
			new URL(
				"https://dev.kanto.ac/map/api/map/v1/features?south=52.4&west=-0.8&north=52.6&east=-0.6&pokemon=1"
			)
		);
	});

	it("rejects a truncated Kanto response instead of reporting an empty scan", async () => {
		const mockFetch = vi.fn(
			async () => new Response(JSON.stringify({ features: [], truncated: true, mode: "density" }))
		) as unknown as typeof fetch;

		await expect(
			queryKantoMapObjects(
				MapObjectType.NEST,
				{ minLat: 52.4, minLon: -0.8, maxLat: 52.6, maxLon: -0.6 },
				100,
				mockFetch
			)
		).rejects.toMatchObject({ status: 503 });
	});

	it("maps one Kanto nest polygon into a Diadem nest", async () => {
		const mockFetch = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						updated_at: "2026-08-17T20:00:00Z",
						truncated: false,
						features: [
							{
								id: "nest-1",
								kind: "nest",
								latitude: 52.5,
								longitude: -0.7,
								pokemon_id: 25,
								nest_chance: 25,
								spawnpoints: 4,
								geometry: {
									type: "Polygon",
									coordinates: [
										[
											[-0.71, 52.49],
											[-0.69, 52.49],
											[-0.71, 52.49]
										]
									]
								}
							}
						]
					})
				)
		) as unknown as typeof fetch;

		const result = await queryKantoMapObjects(
			MapObjectType.NEST,
			{ minLat: 52.4, minLon: -0.8, maxLat: 52.6, maxLon: -0.6 },
			100,
			mockFetch
		);

		expect(result.data[0]).toEqual(
			expect.objectContaining({
				id: "nest-1",
				pokemon_id: 25,
				spawnpoints: 4,
				pokemon_avg: 1,
				polygon: [
					[
						{ x: -0.71, y: 52.49 },
						{ x: -0.69, y: 52.49 },
						{ x: -0.71, y: 52.49 }
					]
				]
			})
		);
		expect(mockFetch).toHaveBeenCalledWith(
			new URL(
				"https://dev.kanto.ac/map/api/map/v1/features?south=52.4&west=-0.8&north=52.6&east=-0.6&pokemon=1"
			)
		);
	});

	it("proxies the legacy laboratory lure URL through the configured Kanto API", async () => {
		const mockFetch = vi.fn(
			async () =>
				new Response('{"features":[]}', {
					status: 200,
					headers: { "cache-control": "no-store", "content-type": "application/json" }
				})
		) as unknown as typeof fetch;

		const response = await proxyKantoLureSpawns(
			new URL("https://dev.kanto.ac/map/api/map/v1/lure-spawns?south=49&west=-9&north=61&east=3"),
			mockFetch
		);

		expect(mockFetch).toHaveBeenCalledWith(
			new URL("https://dev.kanto.ac/map/api/map/v1/lure-spawns?south=49&west=-9&north=61&east=3"),
			{ cache: "no-store" }
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("no-store");
	});

	it("maps Kanto gym capacity and anonymous defenders", async () => {
		const mockFetch = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						updated_at: "2026-08-17T20:00:00Z",
						truncated: false,
						features: [
							{
								id: "gym-1",
								kind: "gym",
								latitude: 52.51,
								longitude: -0.71,
								capacity: 3,
								prestige: 4_000,
								defenders: [{ pokemon_id: 25, cp: 500, deployed_at: "2026-08-17T19:00:00Z" }]
							}
						]
					})
				)
		) as unknown as typeof fetch;

		const result = await queryKantoMapObjects(
			MapObjectType.GYM,
			{ minLat: 52.4, minLon: -0.8, maxLat: 52.6, maxLon: -0.6 },
			100,
			mockFetch
		);

		expect(result.data[0]).toEqual(
			expect.objectContaining({
				total_slots: 3,
				availble_slots: 2,
				total_cp: 4_000,
				defenders: [expect.objectContaining({ pokemon_id: 25, cp_now: 500 })]
			})
		);
		expect(mockFetch).toHaveBeenCalledWith(
			new URL(
				"https://dev.kanto.ac/map/api/map/v1/features?south=52.4&west=-0.8&north=52.6&east=-0.6&forts=1"
			)
		);
	});

	it("loads a direct-linked Kanto object by id", async () => {
		const mockFetch = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						updated_at: "2026-08-17T20:00:00Z",
						feature: {
							id: "spawn-1",
							kind: "pokemon",
							latitude: 52.5,
							longitude: -0.7,
							pokemon_id: 25,
							expires_at: "2026-08-17T20:05:00Z"
						}
					})
				)
		) as unknown as typeof fetch;

		await expect(queryKantoMapObject(MapObjectType.POKEMON, "spawn-1", mockFetch)).resolves.toEqual(
			expect.objectContaining({ id: "spawn-1", pokemon_id: 25 })
		);
		expect(mockFetch).toHaveBeenCalledWith(
			new URL("https://dev.kanto.ac/map/api/map/v1/features/spawn-1")
		);
	});
});
