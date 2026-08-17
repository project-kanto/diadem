import { base } from "$app/paths";

export const appPath = (path: string) => `${base}${path.startsWith("/") ? path : `/${path}`}`;
