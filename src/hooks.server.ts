import type { Handle, ServerInit } from "@sveltejs/kit";

import { getUserByDiscordId } from "@/lib/server/auth/auth";
import {
	AUTH_BASE_PATH,
	auth,
	getAuthSession,
	getDiscordAccessToken,
	isAuthEnabled
} from "@/lib/server/auth/betterAuth";
import TTLCache from "@isaacs/ttlcache";
import { getEveryonePerms, updatePermissions } from "@/lib/server/auth/permissions";
import type { User } from "@/lib/server/db/internal/schema";
import { PERMISSION_UPDATE_INTERVAL } from "@/lib/constants";
import type { Perms } from "@/lib/utils/features";
import { locales, serverAsyncLocalStorage } from "@/lib/paraglide/runtime";
import { paraglideMiddleware } from "@/lib/paraglide/server";
import { sequence } from "@sveltejs/kit/hooks";
import { setServerLoggerFactory } from "@/lib/utils/logger";
import { getServerLogger } from "@/lib/server/logging";
import { getClientConfig, getServerConfig } from "@/lib/services/config/config.server";
import { setConfig } from "@/lib/services/config/config";
import { getDisallowedPaths } from "@/lib/utils/disallowedPaths";
import { appPath } from "@/lib/utils/appPath";
import { getKantoAccessRoute, getKantoScannerAccess } from "@/lib/server/api/kantoAccess";

import { openScannerSession, sealScannerSession } from "@/lib/server/api/launcherScanner";

process.title = "Diadem";

const paraglideHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;

		// set locale for ssr metadata
		const langParam = event.url.searchParams.get("lang");
		const isValidLang = !!langParam && (locales as readonly string[]).includes(langParam);
		if (isValidLang) {
			const store = serverAsyncLocalStorage?.getStore();
			if (store) store.locale = langParam as (typeof locales)[number];
		}
		// Use the validated lang only — `effectiveLocale` is interpolated into
		// `<html lang="%lang%">` so any unvalidated value is reflected XSS.
		const effectiveLocale = isValidLang ? langParam! : locale;

		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace("%lang%", effectiveLocale)
		});
	});

const permissionCache: TTLCache<string, Perms> = new TTLCache({
	ttl: PERMISSION_UPDATE_INTERVAL * 1000
});
const authLog = getServerLogger("auth");
const permissionUpdateInFlight = new Map<string, Promise<Perms>>();

const publicRoutePrefixes = [appPath("/api/locale/"), appPath("/assets/")];
const publicRoutes = new Set(
	["/api/config", "/api/pogodata", "/api/koji", "/api/stats"].map(appPath)
);

function isPublicRoute(pathname: string) {
	return (
		publicRoutes.has(pathname) || publicRoutePrefixes.some((prefix) => pathname.startsWith(prefix))
	);
}

function updatePermissionsLocked(user: User, accessToken: string, thisFetch: typeof fetch) {
	let updatePromise = permissionUpdateInFlight.get(user.id);
	if (!updatePromise) {
		updatePromise = updatePermissions(user, accessToken, thisFetch).finally(() => {
			permissionUpdateInFlight.delete(user.id);
		});
		permissionUpdateInFlight.set(user.id, updatePromise);
	}
	return updatePromise;
}

const handleAuth: Handle = async ({ event, resolve }) => {
	event.locals.kantoScannerAccess = null;
	if (process.env.BUILD_TARGET === "native") {
		event.locals.perms = { everywhere: [], areas: [] };
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	if (auth && event.url.pathname.startsWith(`${AUTH_BASE_PATH}/`)) {
		return auth.handler(event.request);
	}

	// These endpoints never use request-specific permissions. Avoid a session, database,
	// and Koji lookup so they remain safe and useful CDN cache candidates.
	if (isPublicRoute(event.url.pathname)) {
		event.locals.perms = { everywhere: [], areas: [] };
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const mapRoot = appPath("/").replace(/\/$/, "");
	const scannerKey =
		process.env.KANTO_LAUNCHER_SCANNER_KEY ||
		getServerConfig().auth.secret ||
		process.env.BETTER_AUTH_SECRET ||
		process.env.AUTH_SECRET ||
		"";
	const audience = getServerConfig().kanto?.url || "";
	if (audience && event.url.pathname === `${mapRoot}/api/launcher-session`) {
		if (event.request.method !== "POST") return new Response(null, { status: 405 });
		const session = event.request.headers
			.get("authorization")
			?.match(/^Bearer ([A-Za-z0-9_-]{32,256})$/)?.[1];
		if (!session) return new Response(null, { status: 401 });
		const access = await getKantoScannerAccess(`__Host-kanto_session=${session}`, event.fetch);
		if (!access || "response" in access)
			return new Response(null, { status: access?.response?.status || 503 });
		try {
			return Response.json(sealScannerSession(session, scannerKey, audience), {
				headers: { "cache-control": "no-store" }
			});
		} catch {
			return new Response(null, { status: 503 });
		}
	}
	// The framed document contains no account data; every API request still requires access.
	const launcherShell =
		audience &&
		event.request.method === "GET" &&
		(event.url.pathname === mapRoot || event.url.pathname === `${mapRoot}/`) &&
		event.url.searchParams.get("launcher") === "1";
	const needsKantoAccess =
		Boolean(getServerConfig().kanto) &&
		!launcherShell &&
		(event.url.pathname === mapRoot ||
			event.url.pathname === `${mapRoot}/` ||
			event.url.pathname.startsWith(`${mapRoot}/api/`));
	if (needsKantoAccess) {
		const scoped = event.request.headers.get("x-kanto-scanner");
		const session = scoped ? openScannerSession(scoped, scannerKey, audience) : null;
		if (scoped && !session) return new Response(null, { status: 401 });
		const result = await getKantoScannerAccess(
			session ? `__Host-kanto_session=${session}` : (event.request.headers.get("cookie") ?? ""),
			event.fetch
		);
		if (!result || "response" in result) {
			const status = result?.response?.status ?? 503;
			const accessRoute = getKantoAccessRoute(status);
			if (
				accessRoute &&
				event.request.method === "GET" &&
				event.request.headers.get("accept")?.includes("text/html")
			) {
				return new Response(null, {
					status: 303,
					headers: { location: appPath(accessRoute) }
				});
			}
			return new Response("scanner access required", { status });
		}
		event.locals.kantoScannerAccess = result.access;
	}

	event.locals.perms = await getEveryonePerms(event.fetch);
	event.locals.user = null;
	event.locals.session = null;

	if (!isAuthEnabled()) {
		const response = await resolve(event);
		if (launcherShell) {
			response.headers.set(
				"Content-Security-Policy",
				"frame-ancestors tauri://localhost http://tauri.localhost https://tauri.localhost http://localhost:1420"
			);
			response.headers.delete("X-Frame-Options");
			response.headers.set("Referrer-Policy", "no-referrer");
		}
		return response;
	}

	const authSession = await getAuthSession(event);
	if (!authSession?.session || !authSession.user) {
		return resolve(event);
	}

	const discordId = authSession.user.discordId;
	if (!discordId) {
		authLog.warning("Authenticated user has no discordId in Better Auth session");
		return resolve(event);
	}

	const user = await getUserByDiscordId(discordId);
	if (!user) {
		authLog.warning(`No user row found for Discord id ${discordId}`);
		return resolve(event);
	}

	let perms = permissionCache.get(user.id);
	if (!perms) {
		const accessToken = await getDiscordAccessToken(event);
		try {
			perms = await updatePermissionsLocked(user, accessToken ?? "", event.fetch);
			permissionCache.set(user.id, perms);
		} catch (error) {
			authLog.warning(`Failed to update permissions for user ${user.id}: ${error}`);
			perms = event.locals.perms;
		}
	}

	event.locals.user = user;
	event.locals.session = authSession.session;
	event.locals.perms = perms;
	return resolve(event);
};

export const init: ServerInit = async () => {
	// set config for ssr
	const config = getClientConfig();
	setConfig(config);

	setServerLoggerFactory((name) => {
		const winstonLogger = getServerLogger(name);
		return {
			debug: (message, ...args) => winstonLogger.debug(message, ...args),
			info: (message, ...args) => winstonLogger.info(message, ...args),
			warning: (message, ...args) => winstonLogger.warning(message, ...args),
			error: (message, ...args) => winstonLogger.error(message, ...args),
			crit: (message, ...args) => winstonLogger.crit(message, ...args)
		};
	});

	if (process.env.BUILD_TARGET === "native") return;

	const { initDiadem } = await import("@/lib/server/init");
	await initDiadem();
};

const handleSeo: Handle = async ({ event, resolve }) => {
	const general = getClientConfig().general;

	return resolve(event, {
		transformPageChunk: ({ html }) => {
			const metaTags: string[] = [];

			const addMeta = (identifier: string, tag: string) => {
				if (!html.includes(identifier)) metaTags.push(tag);
			};

			const isNonindexPath = getDisallowedPaths().some((p) => event.url.pathname.startsWith(p));
			if (!general.allowCrawlers) {
				addMeta('name="robots"', '<meta name="robots" content="noindex, nofollow">');
			} else if (isNonindexPath) {
				addMeta('name="robots"', '<meta name="robots" content="noindex, follow">');
			} else {
				addMeta('name="robots"', '<meta name="robots" content="index, follow">');
			}

			if (general.description) {
				addMeta('name="description"', `<meta name="description" content="${general.description}">`);
				addMeta(
					'property="og:description"',
					`<meta property="og:description" content="${general.description}">`
				);
			}
			if (general.image) {
				addMeta('property="og:image"', `<meta property="og:image" content="${general.image}">`);
				addMeta(
					'name="twitter:image:src"',
					`<meta name="twitter:image:src" content="${general.image}">`
				);
				addMeta('name="twitter:card"', '<meta name="twitter:card" content="summary_large_image">');
			}
			if (general.url) {
				addMeta('rel="canonical"', `<link rel="canonical" href="${general.url}">`);
				addMeta('property="og:url"', `<meta property="og:url" content="${general.url}">`);
				if (!general.image) {
					addMeta(
						'property="og:image"',
						`<meta property="og:image" content="${general.url}/thumbnail.png">`
					);
					addMeta(
						'name="twitter:image:src"',
						`<meta name="twitter:image:src" content="${general.url}/thumbnail.png">`
					);
					addMeta(
						'name="twitter:card"',
						'<meta name="twitter:card" content="summary_large_image">'
					);
				}
			}

			addMeta('property="og:title"', `<meta property="og:title" content="${general.mapName}">`);
			addMeta('name="twitter:title"', `<meta name="twitter:title" content="${general.mapName}">`);
			addMeta(
				'property="og:site_name"',
				`<meta property="og:site_name" content="${general.mapName}">`
			);
			addMeta('name="twitter:site"', `<meta name="twitter:site" content="${general.mapName}">`);
			if (general.description) {
				addMeta(
					'name="twitter:description"',
					`<meta name="twitter:description" content="${general.description}">`
				);
			}
			addMeta('property="og:type"', '<meta property="og:type" content="website">');

			if (metaTags.length === 0) return html;
			return html.replace("</head>", metaTags.join("\n") + "\n</head>");
		}
	});
};

export const handle: Handle = sequence(paraglideHandle, handleAuth, handleSeo);
