<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		children,
		isSelected = $bindable(),
		onclick = () => {},
		class: class_ = ""
	}: {
		children: Snippet;
		isSelected: boolean;
		onclick?: (isSelected: boolean) => void;
		class?: string;
	} = $props();
</script>

<button
	class="cursor-pointer hover:bg-accent rounded-sm border border-border flex flex-col items-center pt-2 pb-1 px-1 gap-1 {class_}"
	aria-pressed={isSelected}
	class:dark:bg-(--color-attr-chip-dark-bg)={isSelected}
	class:dark:border-(--color-attr-chip-dark-border)={isSelected}
	class:dark:text-(--color-attr-chip-dark-text)={isSelected}
	class:bg-(--color-attr-chip-bg)={isSelected}
	class:border-(--color-attr-chip-border)={isSelected}
	class:text-(--color-attr-chip-text)={isSelected}
	onclick={() => {
		isSelected = !isSelected;
		onclick(isSelected);
	}}
>
	{@render children()}
</button>
