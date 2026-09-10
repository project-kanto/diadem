import { getServerConfig } from "@/lib/services/config/config.server";
import sharp from "sharp";
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
	url.searchParams.set("v", "3");
	const response = await fetch(url);
	if (!response.ok) error(response.status);
	// Match the normal UICONS' 128 px artwork bounds, not the native client's padded 256 px canvas.
	const image = await sharp(Buffer.from(await response.arrayBuffer()))
		.trim({ threshold: 0 })
		.resize(128, 128, { fit: "inside" })
		.png()
		.toBuffer();
	return new Response(new Uint8Array(image), {
		headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" }
	});
};
