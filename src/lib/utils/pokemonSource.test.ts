import { describe, expect, it } from "vitest";
import { isLurePokemon, nameWithDisguise } from "./pokemonSource";

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

describe("nameWithDisguise", () => {
	it("shows a Ditto's disguise in brackets after its name", () => {
		expect(nameWithDisguise("Ditto", "Pidgey")).toBe("Ditto (Pidgey)");
	});

	it("leaves undisguised names unchanged", () => {
		expect(nameWithDisguise("Pidgey", undefined)).toBe("Pidgey");
		expect(nameWithDisguise("Pidgey", null)).toBe("Pidgey");
		expect(nameWithDisguise("Pidgey", "")).toBe("Pidgey");
	});
});
