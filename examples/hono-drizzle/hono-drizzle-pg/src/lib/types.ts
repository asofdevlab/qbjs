import type { HttpBindings } from "@hono/node-server"
import type { OpenAPIHono, RouteConfig, RouteHandler, z } from "@hono/zod-openapi"
import type { Env } from "hono"
import type { PinoLogger } from "hono-pino"
import type { BASE_PATH } from "./constants"
import type { Environment } from "./env"

export interface AppBindings extends Env {
	Bindings: Environment & HttpBindings
	Variables: {
		logger: PinoLogger
	}
}

// biome-ignore lint/complexity/noBannedTypes: <>
export type AppOpenAPI = OpenAPIHono<AppBindings, {}, typeof BASE_PATH>

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>

export type ZodSchema = z.ZodUnion | z.ZodObject | z.ZodArray<z.ZodObject>
export type ZodIssue = z.core.$ZodIssue
