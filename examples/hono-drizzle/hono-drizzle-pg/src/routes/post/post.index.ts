import { createRouter } from "@/api/lib/create-router"
import * as handlers from "@/api/routes/post/post.handlers"
import * as routes from "@/api/routes/post/post.routes"

export const router = createRouter()
	.openapi(routes.list, handlers.list)
	.openapi(routes.create, handlers.create)
	.openapi(routes.search, handlers.search)
	.openapi(routes.getOne, handlers.getOne)
	.openapi(routes.patch, handlers.patch)
	.openapi(routes.remove, handlers.remove)

export default router
