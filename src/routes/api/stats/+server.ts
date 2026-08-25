import { masterstatsProvider } from "@/lib/server/provider/masterStatsProvider";
import { cacheHttpHeaders } from "@/lib/utils/apiUtils.server";
import { json } from "@sveltejs/kit";
import { getServerConfig } from "@/lib/services/config/config.server";
import { queryKantoSpecies } from "@/lib/server/api/kantoApi";

export async function GET() {
	if (getServerConfig().kanto) {
		const species = await queryKantoSpecies();
		return json({
			pokemon: Object.fromEntries(
				species.map(({ pokemon_id, form }) => [`${pokemon_id}-${form}`, {}])
			),
			generatedAt: Math.floor(Date.now() / 1000)
		});
	}
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
