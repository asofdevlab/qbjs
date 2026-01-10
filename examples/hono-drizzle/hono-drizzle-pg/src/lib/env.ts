/** biome-ignore-all lint/style/noProcessEnv: <> */
/** biome-ignore-all lint/style/noNonNullAssertion: <> */
import { config } from "dotenv"
import { expand } from "dotenv-expand"
import { z } from "zod"
import path from "node:path"

expand(
	config({
		path: path.resolve(process.cwd(), process.env.NODE_ENV === "test" ? ".env.test" : ".env"),
	}),
)

const stringBoolean = z.coerce
	.string()
	.transform((val) => {
		return val === "true"
	})
	.default(false)

const EnvSchema = z
	.object({
		NODE_ENV: z.string().min(1).default("development"),
		SERVER_URL: z.string().min(1),
		SERVER_PORT: z.coerce.number().min(1),
		PUBLIC_CLIENT_URL: z.string().min(1),
		LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
		DB_SEEDING: stringBoolean,
		DATABASE_URL: z.string().min(1),
	})
	.superRefine((input, ctx) => {
		if (input.NODE_ENV === "production" && !input.DATABASE_URL) {
			ctx.addIssue({
				code: "invalid_type",
				expected: "string",
				path: ["DATABASE_URL"],
				message: "Must be set when NODE_ENV is production",
			})
		}
	})

export type Environment = z.infer<typeof EnvSchema>

export function parseEnv(data: any) {
	const { data: env, error } = EnvSchema.safeParse(data)

	if (error) {
		const errorMessage = `❌ Invalid env: ${JSON.stringify(z.treeifyError(error), null, 2)}`
		throw new Error(errorMessage)
	}

	return env
}
