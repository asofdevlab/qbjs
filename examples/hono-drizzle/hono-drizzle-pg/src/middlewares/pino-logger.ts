import type { Context, MiddlewareHandler } from "hono"
import type { Env } from "hono-pino"
import { pinoLogger as logger } from "hono-pino"
import pino from "pino"
import pretty from "pino-pretty"
import { randomUUID } from "node:crypto"
import type { AppBindings } from "@/api/lib/types"

export function pinoLoggerMiddleware() {
	return ((c, next) =>
		logger({
			pino: pino(
				{
					level: c.env.LOG_LEVEL || "info",
				},
				c.env.NODE_ENV === "production" ? undefined : pretty(),
			),
			http: {
				reqId: () => randomUUID(),
			},
		})(c as unknown as Context<Env>, next)) satisfies MiddlewareHandler<AppBindings>
}
