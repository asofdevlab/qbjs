import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
	resolve: {
		alias: {
			"@/api": path.resolve(__dirname, "./src"),
		},
	},
})
