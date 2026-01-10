import { parseEnv } from "./env"

function getEnv() {
	// biome-ignore lint/style/noProcessEnv: <>
	return parseEnv(process.env)
}

export const env = getEnv()
