import { requestId } from "hono/request-id"
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares"
import { pinoLoggerMiddleware } from "@/api/middlewares/pino-logger"
import { corsMiddleware } from "../middlewares/cors-middleware"
import { BASE_PATH } from "./constants"
import { createRouter } from "./create-router"
import type { AppOpenAPI } from "./types"

export default function createApp() {
	const app = createRouter().basePath(BASE_PATH) as AppOpenAPI
	app.use("*", corsMiddleware())
	app.use(requestId())
	app.use(serveEmojiFavicon("🔥"))
	app.use(pinoLoggerMiddleware())
	app.onError(onError)
	app.notFound(notFound)
	return app
}

export function createTestApp<R extends AppOpenAPI>(router: R) {
	return createApp().route("/", router)
}
