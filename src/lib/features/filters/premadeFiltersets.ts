import type { FilterCategory } from "@/lib/features/filters/filters";
import type {
	AnyFilterset,
	BaseFilterset,
	FiltersetPokemon,
	FiltersetRaid
} from "@/lib/features/filters/filtersets";
import { getPremadeInvasionFiltersets } from "@/lib/features/filters/filterUtilsInvasion";
import { getPremadeQuestFiltersets } from "@/lib/features/filters/filterUtilsQuest";
import { IconCategory } from "@/lib/features/filters/icons";
import { MODIFIER_COLORS } from "@/lib/features/filters/modifierPresets";
import { RaidLevel } from "@/lib/utils/gymUtils";
import { getId } from "@/lib/utils/uuid";

export const premadeFiltersets: { [key in FilterCategory]?: AnyFilterset[] } = {
	pokemon: [
		filterset<FiltersetPokemon>({
			emoji: "🌿",
			title: "rarity_common",
			rarity: ["common"]
		}),
		filterset<FiltersetPokemon>({
			emoji: "✨",
			title: "rarity_uncommon",
			rarity: ["uncommon"]
		}),
		filterset<FiltersetPokemon>({
			emoji: "💎",
			title: "rarity_rare",
			rarity: ["rare", "ultra rare"]
		}),
		filterset<FiltersetPokemon>({
			emoji: "💯",
			title: "filter_template_hundo",
			iv: { min: 100, max: 100 },
			modifiers: {
				glow: {
					color: MODIFIER_COLORS.red
				}
			}
		}),
		filterset<FiltersetPokemon>({
			emoji: "🗑️",
			title: "filter_template_nundo",
			iv: { min: 0, max: 0 },
			modifiers: {
				rotation: 180
			}
		})
	],
	raid: [
		filterset<FiltersetRaid>({
			uicon: {
				category: IconCategory.RAID,
				params: { level: RaidLevel.LEGENDARY }
			},
			title: "filter_template_raids_5",
			levels: [RaidLevel.LEGENDARY]
		}),
		filterset<FiltersetRaid>({
			uicon: {
				category: IconCategory.RAID,
				params: { level: RaidLevel.SHADOW_LEGENDARY }
			},
			title: "filter_template_raids_5_shadow",
			levels: [RaidLevel.SHADOW_LEGENDARY]
		}),
		filterset<FiltersetRaid>({
			uicon: {
				category: IconCategory.RAID,
				params: { level: RaidLevel.ULTRA_BEAST }
			},
			title: "filter_template_raids_ultra_beast",
			levels: [RaidLevel.ULTRA_BEAST]
		}),
		filterset<FiltersetRaid>({
			uicon: {
				category: IconCategory.RAID,
				params: { level: RaidLevel.MEGA }
			},
			title: "filter_template_raids_mega",
			levels: [RaidLevel.MEGA]
		}),
		filterset<FiltersetRaid>({
			uicon: {
				category: IconCategory.RAID,
				params: { level: RaidLevel.MEGA_LEGENDARY }
			},
			title: "filter_template_raids_mega_legendary",
			levels: [RaidLevel.MEGA_LEGENDARY]
		}),
		filterset<FiltersetRaid>({
			uicon: {
				category: IconCategory.RAID,
				params: { level: RaidLevel.PRIMAL }
			},
			title: "filter_template_raids_primal",
			levels: [RaidLevel.PRIMAL]
		}),
		filterset<FiltersetRaid>({
			uicon: {
				category: IconCategory.RAID,
				params: { level: RaidLevel.ELITE }
			},
			title: "filter_template_raids_elite",
			levels: [RaidLevel.ELITE]
		}),
		filterset<FiltersetRaid>({
			uicon: {
				category: IconCategory.RAID,
				params: { level: RaidLevel.MEGA_SUPER }
			},
			title: "super_mega_raids",
			levels: [RaidLevel.MEGA_SUPER]
		}),
		filterset<FiltersetRaid>({
			uicon: {
				category: IconCategory.RAID,
				params: { level: RaidLevel.MEGA_SUPER_LEGENDARY }
			},
			title: "legendary_super_mega_raids",
			levels: [RaidLevel.MEGA_SUPER_LEGENDARY]
		}),
		filterset<FiltersetRaid>({
			uicon: {
				category: IconCategory.RAID,
				params: { level: RaidLevel.SHADOW_STAR_3 }
			},
			title: "filter_template_raids_shadow",
			levels: [RaidLevel.SHADOW_STAR_1, RaidLevel.SHADOW_STAR_3, RaidLevel.SHADOW_LEGENDARY]
		})
	]
};

export function getPremadeFiltersets(category: FilterCategory) {
	const filters = [...(premadeFiltersets[category] ?? [])];

	if (category === "quest") {
		const questFilters = getPremadeQuestFiltersets();
		if (!questFilters) return;
		filters.push(...questFilters);
	} else if (category === "invasion") {
		const invasionFilters = getPremadeInvasionFiltersets();
		if (!invasionFilters) return;
		filters.push(...invasionFilters);
	}

	if (!filters.length) return;

	return filters;
}

type BaseParams = {
	emoji?: BaseFilterset["icon"]["emoji"];
	uicon?: BaseFilterset["icon"]["uicon"];
	modifiers?: BaseFilterset["modifiers"];
	title: BaseFilterset["title"]["message"];
};

type Params<Filterset extends AnyFilterset> = BaseParams &
	Partial<Omit<Filterset, keyof BaseFilterset>>;

function filterset<Filterset extends AnyFilterset>(options: Params<Filterset>): Filterset {
	const { title, uicon, emoji, ...rest } = options;

	const data = {
		id: getId(),
		icon: {
			isUserSelected: false
		},
		title: {
			message: title
		},
		enabled: true,
		...rest
	} as unknown as Filterset;
	if (uicon) data.icon.uicon = uicon;
	if (emoji) data.icon.emoji = emoji;

	return data;
}
