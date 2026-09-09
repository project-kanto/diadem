import { expect, it, vi } from "vitest";
import sharp from "sharp";
import { GET } from "./[id]/+server";
vi.mock("@/lib/services/config/config.server", () => ({
	getServerConfig: () => ({ kanto: { url: "https://test.invalid/" } })
}));
it("serves shiny art at normal scanner icon size without its native transparent padding", async () => {
	const art = await sharp({ create: { width: 100, height: 50, channels: 4, background: "red" } })
		.png()
		.toBuffer();
	const padded = await sharp({
		create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
	})
		.composite([{ input: art }])
		.png()
		.toBuffer();
	const response = await GET({
		params: { id: "25" },
		fetch: async () => new Response(padded)
	} as never);
	const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
	expect([metadata.width, metadata.height]).toEqual([128, 64]);
});
