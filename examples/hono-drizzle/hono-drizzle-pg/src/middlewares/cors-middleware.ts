import type { MiddlewareHandler } from "hono"
import { cors } from "hono/cors"
import type { AppBindings } from "../lib/types"

export function corsMiddleware() {
	return (async (c, next) => {
		return cors({
			origin: [c.env.PUBLIC_CLIENT_URL],
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["POST", "GET", "PUT", "PATCH", "DELETE", "OPTIONS"],
			exposeHeaders: ["Content-Length"],
			maxAge: 3600,
			credentials: true,
		})(c, next)
	}) satisfies MiddlewareHandler<AppBindings>
}
