<script lang="ts">
	import FiltersetModal from "@/components/menus/filters/filterset/FiltersetModal.svelte";
	import AttributeChip from "@/components/menus/filters/filterset/AttributeChip.svelte";
	import Attribute from "@/components/menus/filters/filterset/Attribute.svelte";
	import AttributesOverview from "@/components/menus/filters/filterset/AttributesOverview.svelte";
	import SliderRange from "@/components/ui/input/slider/SliderRange.svelte";
	import Button from "@/components/ui/input/Button.svelte";
	import type { FiltersetPokemon } from "@/lib/features/filters/filtersets";
	import { makeAttributePokemonLabel } from "@/lib/features/filters/makeAttributeChipLabel";
	import { getCurrentSelectedFilterset } from "@/lib/features/filters/filtersetPageData.svelte.js";
	import * as m from "@/lib/paraglide/messages";
	import { changeAttributeMinMax } from "@/lib/features/filters/filtersetUtils.svelte";
	import IvChips from "@/components/menus/filters/filterset/pokemon/IvChips.svelte";
	import IvAttribute from "@/components/menus/filters/filterset/pokemon/IvAttribute.svelte";
	import {
		getAttributeLabelRank,
		getPokemonRarityLabel,
		pokemonBounds
	} from "@/lib/features/filters/filterUtilsPokemon";
	import PokemonFilterDisplay from "@/components/menus/filters/filterset/pokemon/PokemonFilterDisplay.svelte";
	import { MapObjectType } from "@/lib/mapObjects/mapObjectTypes";
	import PokemonSelectPage from "@/components/menus/filters/filterset/multiselect/PokemonSelectPage.svelte";
	import { getSpawnablePokemon } from "@/lib/features/masterStats.svelte";
	import { hasFeatureAnywhere } from "@/lib/services/user/checkPerm";
	import { getUserDetails } from "@/lib/services/user/userDetails.svelte";
	import { Features } from "@/lib/utils/features";
	import type { PokemonRarity } from "@/lib/types/mapObjectData/pokemon";

	const rarityOptions: PokemonRarity[] = ["common", "uncommon", "rare", "ultra rare"];

	function toggleRarity(filter: FiltersetPokemon, rarity: PokemonRarity) {
		filter.rarity = filter.rarity?.includes(rarity)
			? filter.rarity.filter((value) => value !== rarity)
			: [...(filter.rarity ?? []), rarity];
		if (filter.rarity.length === 0) delete filter.rarity;
	}

	let data: FiltersetPokemon | undefined = $derived(getCurrentSelectedFilterset()?.data) as
		| FiltersetPokemon
		| undefined;

	let canIv = $derived(hasFeatureAnywhere(getUserDetails().permissions, Features.POKEMON_IV));
	let canPvp = $derived(hasFeatureAnywhere(getUserDetails().permissions, Features.POKEMON_PVP));
</script>

<FiltersetModal
	modalType="filtersetPokemon"
	mapObject={MapObjectType.POKEMON}
	majorCategory="pokemon"
	titleBase={m.pokemon_filter()}
	titleShared={m.shared_pokemon_filter()}
	titleNew={m.filterset_title_new_pokemon()}
	titleEdit={m.filterset_title_edit_pokemon()}
>
	{#snippet base()}
		{#if data}
			<PokemonFilterDisplay {data} />
		{/if}
	{/snippet}
	{#snippet overview()}
		{#if data}
			<AttributesOverview>
				<Attribute label={m.species()}>
					<AttributeChip
						label={makeAttributePokemonLabel(data.pokemon ?? [])}
						isEmpty={!data.pokemon}
						onremove={() => delete data.pokemon}
					/>
					{#snippet page(thisData: FiltersetPokemon)}
						<!--						<SpeciesAttribute data={thisData} />-->
						<PokemonSelectPage
							data={thisData}
							attribute="pokemon"
							pokemonList={getSpawnablePokemon()}
						/>
					{/snippet}
				</Attribute>
				<Attribute label={m.rarity()}>
					<AttributeChip
						label={(data.rarity ?? []).map(getPokemonRarityLabel).join(", ")}
						isEmpty={!data.rarity}
						onremove={() => delete data.rarity}
					/>
					{#snippet page(thisData: FiltersetPokemon)}
						<div class="grid grid-cols-2 gap-2">
							{#each rarityOptions as rarity}
								<Button
									variant={thisData.rarity?.includes(rarity) ? "secondary" : "outline"}
									aria-pressed={thisData.rarity?.includes(rarity) ?? false}
									onclick={() => toggleRarity(thisData, rarity)}
								>
									{getPokemonRarityLabel(rarity)}
								</Button>
							{/each}
						</div>
					{/snippet}
				</Attribute>
			</AttributesOverview>
			{#if canIv}
				<AttributesOverview>
					<Attribute label={m.pogo_ivs()}>
						<IvChips {data} ivBounds={pokemonBounds.iv} percBounds={pokemonBounds.ivProduct} />
						{#snippet page(thisData: FiltersetPokemon)}
							<IvAttribute
								data={thisData}
								ivBounds={pokemonBounds.iv}
								percBounds={pokemonBounds.ivProduct}
							/>
						{/snippet}
					</Attribute>
				</AttributesOverview>
			{/if}

			{#if canPvp}
				<AttributesOverview>
					<Attribute label={m.little_league()}>
						<AttributeChip
							label={getAttributeLabelRank(data?.pvpRankLittle)}
							isEmpty={!data.pvpRankLittle}
							onremove={() => delete data.pvpRankLittle}
						/>
						{#snippet page(thisData: FiltersetPokemon)}
							<SliderRange
								min={pokemonBounds.rank.min}
								max={pokemonBounds.rank.max}
								title={m.little_league_rank()}
								valueMin={thisData.pvpRankLittle?.min ?? pokemonBounds.rank.min}
								valueMax={thisData.pvpRankLittle?.max ?? pokemonBounds.rank.max}
								onchange={([min, max]) =>
									changeAttributeMinMax(
										thisData,
										"pvpRankLittle",
										pokemonBounds.rank.min,
										pokemonBounds.rank.max,
										min,
										max
									)}
							/>
						{/snippet}
					</Attribute>
					<Attribute label={m.great_league()}>
						<AttributeChip
							label={getAttributeLabelRank(data?.pvpRankGreat)}
							isEmpty={!data.pvpRankGreat}
							onremove={() => delete data.pvpRankGreat}
						/>
						{#snippet page(thisData: FiltersetPokemon)}
							<SliderRange
								min={pokemonBounds.rank.min}
								max={pokemonBounds.rank.max}
								title={m.great_league_rank()}
								valueMin={thisData.pvpRankGreat?.min ?? pokemonBounds.rank.min}
								valueMax={thisData.pvpRankGreat?.max ?? pokemonBounds.rank.max}
								onchange={([min, max]) =>
									changeAttributeMinMax(
										thisData,
										"pvpRankGreat",
										pokemonBounds.rank.min,
										pokemonBounds.rank.max,
										min,
										max
									)}
							/>
						{/snippet}
					</Attribute>
					<Attribute label={m.ultra_league()}>
						<AttributeChip
							label={getAttributeLabelRank(data?.pvpRankUltra)}
							isEmpty={!data.pvpRankUltra}
							onremove={() => delete data.pvpRankUltra}
						/>
						{#snippet page(thisData: FiltersetPokemon)}
							<SliderRange
								min={pokemonBounds.rank.min}
								max={pokemonBounds.rank.max}
								title={m.ultra_league_rank()}
								valueMin={thisData.pvpRankUltra?.min ?? pokemonBounds.rank.min}
								valueMax={thisData.pvpRankUltra?.max ?? pokemonBounds.rank.max}
								onchange={([min, max]) =>
									changeAttributeMinMax(
										thisData,
										"pvpRankUltra",
										pokemonBounds.rank.min,
										pokemonBounds.rank.max,
										min,
										max
									)}
							/>
						{/snippet}
					</Attribute>
				</AttributesOverview>
			{/if}
		{/if}
	{/snippet}
</FiltersetModal>
