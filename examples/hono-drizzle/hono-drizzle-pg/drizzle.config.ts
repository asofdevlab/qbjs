import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"
import path from "node:path"
import { env } from "./src/lib/env-runtime"

// biome-ignore lint/style/noProcessEnv: <>
config({ path: path.resolve(process.cwd(), process.env.NODE_ENV === "test" ? ".env.test" : ".env") })

export default defineConfig({
	schema: "./src/db/schemas/index.ts",
	out: "./src/db/migrations",
	dialect: "postgresql",
	casing: "snake_case",
	dbCredentials: {
		url: env.DATABASE_URL,
		ssl: true,
	},
})
