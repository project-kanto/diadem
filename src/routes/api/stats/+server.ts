import { masterstatsProvider } from "@/lib/server/provider/masterStatsProvider";
import { cacheHttpHeaders } from "@/lib/utils/apiUtils.server";
import { json } from "@sveltejs/kit";
import { getServerConfig } from "@/lib/services/config/config.server";

export async function GET() {
	if (getServerConfig().kanto) return json({ pokemon: {}, generatedAt: 0 });
	try {
		const stats = await masterstatsProvider.get();
		return json(stats, { headers: cacheHttpHeaders(300, 3600, 3600) });
	} catch (e) {
		return json(
			{
				pokemon: {},
				generatedAt: 0
			},
			{ headers: cacheHttpHeaders(300, 3600, 3600) }
		);
	}
}
