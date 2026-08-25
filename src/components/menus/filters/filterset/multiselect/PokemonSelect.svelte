<script lang="ts">
	import { mPokemon } from "@/lib/services/ingameLocale";
	import * as m from "@/lib/paraglide/messages";
	import { resize } from "@/lib/services/assets";
	import { getIconPokemon } from "@/lib/services/uicons.svelte.js";
	import type { PokemonVisual } from "@/lib/types/mapObjectData/pokemon";
	import { slide } from "svelte/transition";
	import type { HighlightRanges } from "@nozbe/microfuzz";
	import { createFuzzySearch, highlightSearchMatches } from "@/lib/services/search.svelte.js";
	import MultiSelect from "@/components/menus/filters/filterset/multiselect/MultiSelect.svelte";
	import MultiSelectItem from "@/components/menus/filters/filterset/multiselect/MultiSelectItem.svelte";
	import { Check } from "@lucide/svelte";

	let {
		pokemonList,
		selected,
		onselect,
		title,
		query = $bindable(undefined)
	}: {
		pokemonList: PokemonVisual[];
		selected: PokemonVisual[];
		onselect: (pokemon: PokemonVisual, isSelected: boolean) => void;
		title: string;
		query?: string;
	} = $props();

	const searcher = $derived(
		query !== undefined
			? createFuzzySearch(pokemonList, { getText: (p: PokemonVisual) => [mPokemon(p)] })
			: undefined
	);
	let selectedValues = $derived(selected.map((p) => getKey(p)) ?? []);

	function getKey(p: PokemonVisual) {
		return `${p.pokemon_id}-${p.form}-${p.temp_evolution_id}-${p.alignment}-${p.bread_mode}-${p.gender}-${p.costume}`;
	}

	function comparePokemonVisual(a: PokemonVisual, b: PokemonVisual): number {
		return (
			a.pokemon_id - b.pokemon_id ||
			(a.form ?? 0) - (b.form ?? 0) ||
			(a.temp_evolution_id ?? 0) - (b.temp_evolution_id ?? 0) ||
			(a.costume ?? 0) - (b.costume ?? 0)
		);
	}

	let fuzzyResults = $derived.by(() => {
		const q = query?.trim();
		if (!q) return null;

		return searcher?.(q) ?? null;
	});

	let highlights = $derived.by(() => {
		if (!fuzzyResults) return undefined;

		const map = new Map<string, HighlightRanges>();
		for (const r of fuzzyResults) {
			if (r.matches[0]) {
				map.set(getKey(r.item), r.matches[0]);
			}
		}
		return map;
	});

	let sortedList = $derived.by(() => {
		const list = [...(fuzzyResults ? fuzzyResults.map((r) => r.item) : pokemonList)];
		if (!fuzzyResults) {
			const selectedSet = new Set(selectedValues);
			list.sort(
				(a, b) =>
					Number(selectedSet.has(getKey(b))) - Number(selectedSet.has(getKey(a))) ||
					comparePokemonVisual(a, b)
			);
			return list;
		}
		return list.sort(comparePokemonVisual);
	});
</script>

{#if sortedList.length > 0}
	<div transition:slide={{ duration: 90 }}>
		<h2 class="font-semibold mb-2 ml-0.5">
			{title}
		</h2>

		<MultiSelect class="grid-cols-1! text-sm! font-medium!">
			{#each sortedList as pokemon (getKey(pokemon))}
				{@const isSelected = selectedValues.includes(getKey(pokemon))}

				<MultiSelectItem
					{isSelected}
					class="flex-row! py-2! px-3! gap-3! text-left"
					onclick={(value) => {
						onselect(pokemon, value);
					}}
				>
					<img
						class="size-8"
						alt={mPokemon(pokemon)}
						src={resize(getIconPokemon(pokemon), { width: 64 })}
						loading="lazy"
					/>
					<div class="grow align-middle flex items-center px-1">
						<span class="h-fit" {@attach highlightSearchMatches(highlights?.get(getKey(pokemon)))}>
							{mPokemon(pokemon)}
						</span>
					</div>
					<span
						class="size-5 shrink-0 rounded border border-current flex items-center justify-center"
						aria-hidden="true"
					>
						{#if isSelected}<Check class="size-4" />{/if}
					</span>
				</MultiSelectItem>
			{/each}
		</MultiSelect>
	</div>
{:else}
	<p class="py-6 text-center text-sm text-muted-foreground">{m.nothing_found()}</p>
{/if}
