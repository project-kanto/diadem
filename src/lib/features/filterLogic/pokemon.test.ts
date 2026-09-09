import { describe, expect, it, vi } from "vitest";
import { matchPokemonFilterset } from "./pokemon";
import type { FilterPokemon } from "../filters/filters";
import type { PokemonData } from "@/lib/types/mapObjectData/pokemon";
vi.mock("@/lib/mapObjects/currentSelectedState.svelte", () => ({
	isCurrentSelectedOverwrite: () => false
}));
vi.mock("@/lib/services/userSettings.svelte", () => ({ getUserSettings: () => ({}) }));
vi.mock("@/lib/utils/pokemonUtils", () => ({ getBestRank: () => undefined, League: {} }));

describe("shiny species filtering", () => {
	it("supports every Gen 1 species with normal, shiny and unrestricted filters", () => {
		for (let id = 1; id <= 151; id++) {
			for (const shiny of [undefined, true, false]) {
				const filter = {
					enabled: true,
					filters: [{ enabled: true, pokemon: [{ pokemon_id: id, form: 0 }], shiny }]
				} as FilterPokemon;
				for (const actual of [true, false]) {
					const pokemon = { pokemon_id: id, form: 0, shiny: actual } as PokemonData;
					expect(Boolean(matchPokemonFilterset(pokemon, filter))).toBe(
						shiny === undefined || shiny === actual
					);
					expect(
						matchPokemonFilterset({ ...pokemon, pokemon_id: (id % 151) + 1 }, filter)
					).toBeUndefined();
				}
			}
		}
	});
});
