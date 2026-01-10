import app from "./app"
import { env } from "./lib/env-runtime"

export default {
	port: env.SERVER_PORT,
	fetch: app.fetch,
}
