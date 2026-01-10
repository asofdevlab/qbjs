import { Scalar } from "@scalar/hono-api-reference";
import packageJSON from "../../package.json";
import { BASE_PATH } from "./constants";
import type { AppOpenAPI } from "./types";

export default function configureOpenAPI(app: AppOpenAPI) {
	app.doc("/doc", {
		openapi: "3.0.0",
		info: {
			version: packageJSON.version,
			title: "Hono Drizzle PostgreSQL",
		},
	});

	app.get(
		"/reference",
		Scalar({
			pageTitle: "API Documentation",
			theme: "kepler",
			layout: "modern",
			defaultHttpClient: {
				targetKey: "js",
				clientKey: "fetch",
			},
			sources: [{ url: `${BASE_PATH}/doc`, title: "API" }],
		}),
	);
}
