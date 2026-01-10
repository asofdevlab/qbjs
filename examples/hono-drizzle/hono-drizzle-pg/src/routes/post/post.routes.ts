import { createRoute, z } from "@hono/zod-openapi"
import { enhancedQuerySchema, getOneQuerySchema } from "@qbjs/core/schemas"
import * as HttpStatusCodes from "stoker/http-status-codes"
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers"
import { createErrorSchema } from "stoker/openapi/schemas"
import { insertPostSchema, patchPostSchema, selectPostSchema } from "@/api/db/schemas"
import { notFoundSchema } from "@/api/lib/constants"
import IdCUID2ParamsSchema from "@/api/lib/schemas/id-cuid2-params"
import IdSlugParamsSchema from "@/api/lib/schemas/id-slug-params"
import { queryErrorResponseSchema } from "@/api/lib/schemas/query-error-schema"

/**
 * Enhanced query schema for post list endpoint
 * Extends the base enhanced query schema with post-specific validation
 * Supports both QS bracket notation (filter[title][containsi]=value) and JSON string format
 */
export const postQuerySchema = enhancedQuerySchema.extend({
	/** Filter - accepts QS bracket notation parsed as object or JSON string */
	filter: z
		.union([
			z.record(z.string(), z.any()), // QS bracket notation parsed as object
			z.string().transform((val) => {
				if (!val) return undefined
				try {
					return JSON.parse(val)
				} catch {
					return undefined
				}
			}),
		])
		.optional(),
})

/**
 * Search query schema for post search endpoint
 * Provides full-text search capabilities with pagination
 */
export const searchQuerySchema = enhancedQuerySchema.extend({
	/** Search query string - searches in title and content */
	q: z.string().min(1).max(200).openapi({
		description: "Search query string to search in title and content",
		example: "Hono tutorial",
	}),
	/** Filter - accepts QS bracket notation parsed as object or JSON string */
	filter: z
		.union([
			z.record(z.string(), z.any()), // QS bracket notation parsed as object
			z.string().transform((val) => {
				if (!val) return undefined
				try {
					return JSON.parse(val)
				} catch {
					return undefined
				}
			}),
		])
		.optional(),
})

const tags = ["Posts"]

export const list = createRoute({
	path: "/posts",
	method: "get",
	tags,
	request: {
		query: postQuerySchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(z.array(selectPostSchema), "The list of blog posts"),
		[HttpStatusCodes.BAD_REQUEST]: jsonContent(
			queryErrorResponseSchema,
			"Invalid query parameters - validation failed",
		),
	},
})

export const create = createRoute({
	path: "/posts",
	method: "post",
	tags,
	request: {
		body: jsonContentRequired(insertPostSchema, "The blog post to create"),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(selectPostSchema, "The created blog post"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ error: z.string() }), "Authentication required"),
		[HttpStatusCodes.BAD_REQUEST]: jsonContent(
			queryErrorResponseSchema,
			"Failed to create post - validation or database error",
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(insertPostSchema), "The validation error(s)"),
	},
})

export const getOne = createRoute({
	path: "/posts/{id}/{slug}",
	method: "get",
	tags,
	request: {
		params: IdSlugParamsSchema,
		query: getOneQuerySchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(selectPostSchema, "The requested blog post"),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Blog post not found"),
		[HttpStatusCodes.BAD_REQUEST]: jsonContent(queryErrorResponseSchema, "Invalid query parameters or request error"),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(IdSlugParamsSchema),
			"Invalid id or slug error",
		),
	},
})

export const search = createRoute({
	path: "/posts/search",
	method: "get",
	tags,
	request: {
		query: searchQuerySchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.object({
				data: z.array(selectPostSchema),
				total: z.number(),
				query: z.string(),
			}),
			"Search results with matching blog posts",
		),
		[HttpStatusCodes.BAD_REQUEST]: jsonContent(queryErrorResponseSchema, "Invalid search query parameters"),
	},
})

export const patch = createRoute({
	path: "/posts/{id}",
	method: "patch",
	tags,
	request: {
		params: IdCUID2ParamsSchema,
		body: jsonContentRequired(patchPostSchema, "The updated blog post"),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(selectPostSchema, "The updated post"),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Blog post not found"),
		[HttpStatusCodes.BAD_REQUEST]: jsonContent(
			queryErrorResponseSchema,
			"Failed to update post - validation or database error",
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(patchPostSchema).or(createErrorSchema(IdCUID2ParamsSchema)),
			"The validation error(s)",
		),
	},
})

export const remove = createRoute({
	path: "/posts/{id}",
	method: "delete",
	request: {
		params: IdCUID2ParamsSchema,
	},
	tags,
	responses: {
		[HttpStatusCodes.NO_CONTENT]: {
			description: "Blog post deleted",
		},
		[HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Blog post not found"),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(IdCUID2ParamsSchema), "Invalid id error"),
	},
})

export type BlogListRoute = typeof list
export type BlogCreateRoute = typeof create
export type BlogGetOneRoute = typeof getOne
export type BlogSearchRoute = typeof search
export type BlogPatchRoute = typeof patch
export type BlogRemoveRoute = typeof remove
