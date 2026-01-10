import { z } from "@hono/zod-openapi"

/**
 * Schema for query validation error responses
 * Used in OpenAPI documentation for error responses
 */
export const queryErrorResponseSchema = z.object({
	error: z.string(),
	code: z.string(),
	details: z.array(
		z.object({
			field: z.string(),
			code: z.string(),
			message: z.string(),
			path: z.array(z.string()),
			received: z.any().optional(),
			expected: z.any().optional(),
		}),
	),
	warnings: z.array(
		z.object({
			field: z.string(),
			code: z.string(),
			message: z.string(),
			suggestion: z.string().optional(),
		}),
	),
	suggestions: z.array(z.string()),
	metadata: z.object({
		timestamp: z.string(),
		requestId: z.string(),
		parseTime: z.number(),
	}),
})
