const parents = new Set([
	"tauri://localhost",
	"http://tauri.localhost",
	"https://tauri.localhost",
	"http://localhost:1420"
]);

export async function installLauncherScanner() {
	if (window.parent === window || new URLSearchParams(location.search).get("launcher") !== "1")
		return;
	let token = "";
	let renewalRequested = false;
	const original = window.fetch.bind(window);
	window.fetch = (input, init) => {
		const request = new Request(input, init);
		const url = new URL(request.url);
		if (url.origin === location.origin && url.pathname.startsWith("/map/api/")) {
			const headers = new Headers(request.headers);
			headers.set("x-kanto-scanner", token);
			return original(new Request(request, { headers, credentials: "omit" })).then((response) => {
				if ((response.status === 401 || response.status === 402) && !renewalRequested) {
					renewalRequested = true;
					window.parent.postMessage({ type: "kanto-scanner-renew" }, "*");
				}
				return response;
			});
		}
		return original(request);
	};
	await new Promise<void>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("Reopen Scanner in the launcher.")), 20000);
		window.addEventListener("message", (event) => {
			if (
				event.source !== window.parent ||
				!parents.has(event.origin) ||
				event.data?.type !== "kanto-scanner-session"
			)
				return;
			if (
				typeof event.data.token !== "string" ||
				!/^[A-Za-z0-9_-]{60,2048}$/.test(event.data.token)
			)
				return;
			token = event.data.token;
			renewalRequested = false;
			clearTimeout(timer);
			resolve();
		});
		window.parent.postMessage({ type: "kanto-scanner-ready" }, "*");
	});
}
