import { describe, expect, it, vi } from "vitest";
import { MapObjectType } from "@/lib/mapObjects/mapObjectTypes";
import { proxyKantoLureSpawns, queryKantoMapObject, queryKantoMapObjects } from "./kantoApi";

vi.mock("@/lib/services/config/config.server", () => ({
	getServerConfig: () => ({ kanto: { url: "https://dev.kanto.ac/map/" } })
}));

describe("queryKantoMapObjects", () => {
	it("maps Kanto features into Diadem objects", async () => {
		const mockFetch = vi.fn(async (url: URL | RequestInfo) => {
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
		}) as unknown as typeof fetch;

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
				first_seen_timestamp: 1786996800,
				changed: 1786996800
			}),
			expect.objectContaining({ id: "lure-1", pokemon_id: 133 })
		]);
		expect(mockFetch).toHaveBeenCalledTimes(2);
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
