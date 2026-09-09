import { getServerConfig } from "@/lib/services/config/config.server";
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, fetch }) => {
	const base = getServerConfig().kanto?.url;
	const id = Number(params.id);
	if (!base || !Number.isInteger(id) || id < 1 || id > 151) error(404);
	const url = new URL(
		`static/sprites/shiny/${String(id).padStart(3, "0")}.png`,
		base.endsWith("/") ? base : base + "/"
	);
	const response = await fetch(url);
	if (!response.ok) error(response.status);
	return new Response(response.body, {
		headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" }
	});
};
