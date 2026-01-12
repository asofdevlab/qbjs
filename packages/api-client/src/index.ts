import type { router } from "@examples/hono-drizzle-pg/routes"
import { hc } from "hono/client"

// create instance to inline type in build
// https://hono.dev/docs/guides/rpc#compile-your-code-before-using-it-recommended
const client = hc<router>("")
export type Client = typeof client

export default (...args: Parameters<typeof hc>): Client => hc<router>(...args)

export type ErrorSchema = {
	error: {
		issues: {
			code: string
			path: (string | number)[]
			message?: string | undefined
		}[]
		name: string
	}
	success: boolean
}
