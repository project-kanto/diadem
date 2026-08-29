<script lang="ts">
	import { page } from "$app/state";
	import Button from "@/components/ui/input/Button.svelte";
	import ErrorPage from "@/components/ui/ErrorPage.svelte";
	import * as m from "@/lib/paraglide/messages";

	const signIn = $derived(page.url.searchParams.get("reason") === "signin");
</script>

{#if signIn}
	<ErrorPage
		error={m.scanner_sign_in_needed()}
		description={m.scanner_sign_in_desc()}
		href="/auth/discord/login"
		linkLabel={m.scanner_sign_in()}
	/>
{:else}
	<ErrorPage
		error={m.scanner_access_needed()}
		description={m.scanner_access_options()}
		href="/account"
		linkLabel={m.scanner_view_memberships()}
	>
		{#snippet extraButtons()}
			<Button tag="a" href="/earn/scanner">{m.scanner_earn_hour_free()}</Button>
		{/snippet}
	</ErrorPage>
{/if}
