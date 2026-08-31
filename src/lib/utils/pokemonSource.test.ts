import { describe, expect, it } from "vitest";
import { isLurePokemon } from "./pokemonSource";

describe("isLurePokemon", () => {
	it("recognises both lure sighting variants", () => {
		expect(isLurePokemon({ seen_type: "lure_wild" })).toBe(true);
		expect(isLurePokemon({ seen_type: "lure_encounter" })).toBe(true);
	});

	it("leaves ordinary wild and unknown sightings unmarked", () => {
		expect(isLurePokemon({ seen_type: "wild" })).toBe(false);
		expect(isLurePokemon({ seen_type: undefined })).toBe(false);
	});
});
