import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import * as MdxConfig from "./source.config";

export default defineConfig({
	server: {
		port: 3000,
	},
	plugins: [
		mdx(MdxConfig),
		tailwindcss(),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tanstackStart({
			prerender: {
				enabled: true,
			},
		}),
		react(),
	],
});
