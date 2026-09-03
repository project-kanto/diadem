import type { ClientConfig } from "@/lib/services/config/configTypes";

let config: ClientConfig;

export function setConfig(newConfig: ClientConfig) {
	config = newConfig;
}

export function getConfig() {
	return config;
}

export function resolveConfiguredUiconSet(
	iconSet: { id: string; url: string },
	fallback: { id: string; url: string }
) {
	const configuredIconSet = config.uiconSets.find(({ id }) => id === iconSet.id);
	return configuredIconSet ? { id: configuredIconSet.id, url: configuredIconSet.url } : fallback;
}
