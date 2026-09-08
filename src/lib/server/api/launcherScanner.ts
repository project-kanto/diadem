import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const purpose = "kanto-launcher-scanner-v1";
export const scannerLifetime = 300;

function key(secret: string, audience: string) {
	if (secret.length < 32) throw new Error("Scanner session key is unavailable");
	return createHash("sha256").update(`${purpose}\0${audience}\0${secret}`).digest();
}

export function sealScannerSession(
	session: string,
	secret: string,
	audience: string,
	now = Date.now()
) {
	const nonce = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key(secret, audience), nonce);
	cipher.setAAD(Buffer.from(purpose));
	const expires = Math.floor(now / 1000) + scannerLifetime;
	const data = Buffer.concat([cipher.update(JSON.stringify({ session, expires })), cipher.final()]);
	return {
		token: Buffer.concat([nonce, cipher.getAuthTag(), data]).toString("base64url"),
		expires_at: expires
	};
}

export function openScannerSession(
	token: string,
	secret: string,
	audience: string,
	now = Date.now()
): string | null {
	try {
		if (!/^[A-Za-z0-9_-]{60,2048}$/.test(token)) return null;
		const wire = Buffer.from(token, "base64url");
		const cipher = createDecipheriv("aes-256-gcm", key(secret, audience), wire.subarray(0, 12));
		cipher.setAAD(Buffer.from(purpose));
		cipher.setAuthTag(wire.subarray(12, 28));
		const value = JSON.parse(
			Buffer.concat([cipher.update(wire.subarray(28)), cipher.final()]).toString()
		);
		const seconds = Math.floor(now / 1000);
		return Number.isInteger(value.expires) &&
			value.expires > seconds &&
			value.expires <= seconds + scannerLifetime &&
			typeof value.session === "string" &&
			/^[A-Za-z0-9_-]{32,256}$/.test(value.session)
			? value.session
			: null;
	} catch {
		return null;
	}
}
