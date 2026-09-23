import type { PokemonData } from "@/lib/types/mapObjectData/pokemon";

export function isLurePokemon(data: Pick<PokemonData, "seen_type">): boolean {
	return data.seen_type === "lure_wild" || data.seen_type === "lure_encounter";
}

/**
 * Appends a Ditto's disguise species in brackets, e.g. "Ditto (Pidgey)".
 * Returns the name unchanged when there is no disguise.
 */
export function nameWithDisguise(name: string, disguiseName?: string | null): string {
	return disguiseName ? `${name} (${disguiseName})` : name;
}
