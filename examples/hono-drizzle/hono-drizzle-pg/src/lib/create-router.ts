import { OpenAPIHono } from "@hono/zod-openapi"
import { defaultHook } from "stoker/openapi"
import type { AppBindings } from "./types"

export function createRouter() {
	return new OpenAPIHono<AppBindings>({
		strict: false,
		defaultHook,
	})
}
