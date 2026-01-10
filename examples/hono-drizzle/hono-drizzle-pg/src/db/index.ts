import { config } from "dotenv"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import type { Environment } from "../lib/env"
import * as schema from "./schemas"

config({ path: ".env" })

export function createDb(env: Environment) {
	const client = new Pool({
		connectionString: env.DATABASE_URL,
	})

	const db = drizzle({ client, schema })

	return db
}
