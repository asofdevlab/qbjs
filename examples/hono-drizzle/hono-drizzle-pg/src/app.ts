import configureOpenAPI from "@/api/lib/configure-open-api"
import createApp from "@/api/lib/create-app"
import { registerRoutes } from "./routes"

const app = registerRoutes(createApp())

configureOpenAPI(app)

export default app
