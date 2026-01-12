import { BASE_PATH } from "@/api/lib/constants"
import { createRouter } from "@/api/lib/create-router"
import type { AppOpenAPI } from "@/api/lib/types"
import posts from "./post/post.index"

export function registerRoutes(app: AppOpenAPI) {
	return app.route("/", posts) // all router registered here
}

// stand alone router type used for api client
const router = registerRoutes(createRouter().basePath(BASE_PATH))
export type router = typeof router
