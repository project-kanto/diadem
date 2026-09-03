import type { ClientConfig } from "./configTypes";
import { describe, expect, it } from "vitest";
import { resolveConfiguredUiconSet, setConfig } from "./config";

describe("resolveConfiguredUiconSet", () => {
	it("falls back when a saved icon set was removed", () => {
		setConfig({
			uiconSets: [
				{
					id: "default",
					name: "Default",
					url: "/icons",
					base: { default: true }
				}
			]
		} as ClientConfig);

		expect(
			resolveConfiguredUiconSet(
				{ id: "removed", url: "/removed" },
				{ id: "default", url: "/icons" }
			)
		).toEqual({ id: "default", url: "/icons" });
	});
});
