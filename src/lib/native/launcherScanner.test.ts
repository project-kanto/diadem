import { afterEach, expect, it, vi } from "vitest";
import { installLauncherScanner } from "./launcherScanner";

afterEach(() => vi.unstubAllGlobals());
it("uses the scanner access page and delegates only website access links to the launcher", async () => {
	const postMessage = vi.fn();
	const addEventListener = vi.fn();
	vi.stubGlobal("window", { parent: { postMessage } });
	vi.stubGlobal("document", { addEventListener });
	vi.stubGlobal("location", {
		search: "?launcher=1",
		pathname: "/map/access",
		origin: "https://dev.kanto.ac",
		href: "https://dev.kanto.ac/map/access?launcher=1"
	});
	await installLauncherScanner();
	expect(postMessage).toHaveBeenCalledWith({ type: "kanto-scanner-ready" }, "*");
	const click = addEventListener.mock.calls[0][1];
	for (const [href, allowed] of [
		["https://dev.kanto.ac/earn/scanner", true],
		["https://dev.kanto.ac/account", true],
		["https://evil.example/account", false],
		["javascript:alert(1)", false]
	] as const) {
		postMessage.mockClear();
		const preventDefault = vi.fn();
		click({ target: { closest: () => ({ href }) }, preventDefault });
		expect(preventDefault.mock.calls.length).toBe(allowed ? 1 : 0);
		expect(postMessage.mock.calls.length).toBe(allowed ? 1 : 0);
	}
});
