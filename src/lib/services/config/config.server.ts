import type { Config } from "@/lib/services/config/configTypes";
import fs from "node:fs";
import { parse } from "toml";

const configFile = fs.readFileSync("./src/lib/server/config.toml", "utf8");
const config: Config = parse(configFile);
if (process.env.KANTO_MAP_API_URL && config.server.kanto) {
	config.server.kanto.url = process.env.KANTO_MAP_API_URL;
}

export function getServerConfig() {
	return config.server;
}

export function getClientConfig() {
	return config.client;
}
