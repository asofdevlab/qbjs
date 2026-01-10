import { describe, expect, it } from "vitest"
import { env } from "@/api/lib/env-runtime"
import app from "./app"

describe("Not found", () => {
	it(`GET /api/banana should return {message: "Not Found - /api/banana"}`, async () => {
		const req = new Request(`${env.SERVER_URL}/api/banana`)
		const res = await app.fetch(req, env)
		expect(res.status).toBe(404)
		expect(await res.json()).toHaveProperty("message", "Not Found - /api/banana")
	})
})
