import type { PokemonData } from "@/lib/types/mapObjectData/pokemon";

export function isLurePokemon(data: Pick<PokemonData, "seen_type">): boolean {
	return data.seen_type === "lure_wild" || data.seen_type === "lure_encounter";
}
