import {
	createErrorResponse,
	createLRUCache,
	createQueryBuilder,
	createQueryError,
	type QueryBuilderError,
	type QueryBuilderWarning,
	type QueryError,
	type QueryWarning,
} from "@qbjs/core"
import { createDrizzlePgCompiler } from "@qbjs/core/compiler"
import { and, eq, ilike, or } from "drizzle-orm"
import * as HttpStatusCodes from "stoker/http-status-codes"
import { createDb } from "@/api/db"
import { post } from "@/api/db/schemas"
import { env } from "@/api/lib/env-runtime"
import type { AppRouteHandler } from "@/api/lib/types"
import type {
	BlogCreateRoute,
	BlogGetOneRoute,
	BlogListRoute,
	BlogPatchRoute,
	BlogRemoveRoute,
	BlogSearchRoute,
} from "@/api/routes/post/post.routes"
import { generateUniqueSlug } from "../_helpers/slugify"

const db = createDb(env)

/**
 * LRU Cache for caching post list query results
 *
 * Configuration:
 * - maxSize: Maximum number of cached queries (100)
 * - ttl: Time-to-live for cache entries (60 seconds)
 * - autoCleanup: Automatically remove expired entries
 * - onEvict: Callback when entries are evicted (for logging/monitoring)
 */
const postListCache = createLRUCache<any[]>({
	maxSize: 100,
	ttl: 60000, // 60 seconds
	autoCleanup: true,
	cleanupInterval: 30000, // cleanup every 30 seconds
	onEvict: (key, _value, reason) => {
		console.log(`[Cache] Evicted key "${key}" due to: ${reason}`)
	},
})

/**
 * Generate a cache key from the request URL
 * Normalizes the URL to ensure consistent cache hits
 */
function generateCacheKey(url: string): string {
	const urlObj = new URL(url)
	// Sort query params for consistent cache keys
	const params = new URLSearchParams(urlObj.search)
	const sortedParams = new URLSearchParams([...params.entries()].sort())
	return `${urlObj.pathname}?${sortedParams.toString()}`
}

/**
 * Default fields to return for post queries
 * These fields are returned when no specific fields are requested
 */
const defaultFields: (keyof typeof post._.columns)[] = [
	"id",
	"title",
	"slug",
	"content",
	"thumbnailUrl",
	"published",
	"createdAt",
	"updatedAt",
]

/**
 * Create a query builder using the new AST-based architecture
 * This provides type-safe query parsing, validation, and compilation
 */
const queryBuilder = createQueryBuilder({
	config: {
		allowedFields: defaultFields,
		maxLimit: 100, // max items to return
		defaultLimit: 10, // default items to return
	},
	compiler: createDrizzlePgCompiler(),
})

/**
 * Convert QueryBuilderError to QueryError for backward compatibility
 */
function toQueryErrors(errors: QueryBuilderError[]): QueryError[] {
	return errors.map((err) => createQueryError(err.field, "INVALID_VALUE", err.message, [err.field]))
}

/**
 * Convert QueryBuilderWarning to QueryWarning for backward compatibility
 */
function toQueryWarnings(warnings: QueryBuilderWarning[]): QueryWarning[] {
	return warnings.map((warn) => ({
		code: "IGNORED_FIELD" as const,
		field: warn.field,
		message: warn.message,
		suggestion: "suggestion" in warn ? (warn as any).suggestion : undefined,
	}))
}

/**
 * Performance monitoring helper
 * Tracks query execution time and logs performance metrics
 */
interface PerformanceMetrics {
	startTime: number
	queryParseTime?: number
	dbQueryTime?: number
	totalTime?: number
}

function createPerformanceTracker(): PerformanceMetrics {
	return {
		startTime: performance.now(),
	}
}

function recordParseTime(metrics: PerformanceMetrics): void {
	metrics.queryParseTime = performance.now() - metrics.startTime
}

function recordDbQueryTime(metrics: PerformanceMetrics, dbStartTime: number): void {
	metrics.dbQueryTime = performance.now() - dbStartTime
}

function finalize(metrics: PerformanceMetrics): PerformanceMetrics {
	metrics.totalTime = performance.now() - metrics.startTime
	return metrics
}

/**
 * Create a structured error response for malformed query strings
 * Validates: Requirements 2.5
 */
function createMalformedQueryError(
	message: string,
	requestId: string,
	parseTime: number,
): ReturnType<typeof createErrorResponse> {
	const error = createQueryError("query", "MALFORMED_QUERY", message, ["query"], undefined, "Valid query string format")
	return createErrorResponse(
		"Failed to parse query parameters",
		"MALFORMED_QUERY",
		[error],
		[],
		[
			"Check URL encoding of special characters",
			"Ensure proper bracket notation for nested objects",
			"Verify query parameter format matches API documentation",
		],
		requestId,
		parseTime,
	)
}

/**
 * Create a structured error response for validation failures
 * Validates: Requirements 2.1
 */
function createValidationErrorResponse(
	errors: QueryError[],
	warnings: QueryWarning[],
	requestId: string,
	parseTime: number,
): ReturnType<typeof createErrorResponse> {
	return createErrorResponse(
		"Query parameter validation failed",
		"QUERY_VALIDATION_ERROR",
		errors,
		warnings,
		[],
		requestId,
		parseTime,
	)
}

export const list: AppRouteHandler<BlogListRoute> = async (c) => {
	const requestId = crypto.randomUUID()
	const metrics = createPerformanceTracker()

	try {
		// Generate cache key from the request URL
		const cacheKey = generateCacheKey(c.req.url)

		// Check if we have a cached result
		const cachedData = postListCache.get(cacheKey)
		if (cachedData) {
			const finalMetrics = finalize(metrics)

			// Log cache hit
			c.var.logger.debug(
				`Post list cache hit: ${JSON.stringify({
					requestId,
					cacheKey,
					totalTime: finalMetrics.totalTime?.toFixed(2),
					resultCount: cachedData.length,
					cacheStats: postListCache.getStats(),
				})}`,
			)

			return c.json(cachedData, HttpStatusCodes.OK)
		}

		// Use the new AST-based query builder with URL parsing
		// This handles QS bracket notation for filters automatically
		const result = queryBuilder.executeFromUrl(c.req.url, post)

		// Record query parsing time for performance monitoring
		recordParseTime(metrics)

		// If there are critical errors, return structured error response
		if (result.errors.length > 0) {
			const errorResponse = createValidationErrorResponse(
				toQueryErrors(result.errors),
				toQueryWarnings(result.warnings),
				requestId,
				metrics.queryParseTime || 0,
			)

			c.var.logger.warn(`Query validation failed: ${JSON.stringify({ requestId, errors: result.errors.length })}`)

			return c.json(errorResponse, HttpStatusCodes.BAD_REQUEST)
		}

		// Execute database query with performance tracking
		const dbStartTime = performance.now()

		// Use the compiled query from the AST
		const compiledQuery = result.query

		// Build the where clause combining published filter with user-provided filters
		const data = await db.query.post.findMany({
			// where: compiledQuery?.where ? and(eq(post.published, true), compiledQuery.where) : eq(post.published, true),
			where(fields, operators) {
				const isPublished = operators.eq(fields.published, true)
				if (compiledQuery?.where) {
					return operators.and(isPublished, compiledQuery.where)
				}
				return isPublished
			},
			columns: compiledQuery?.columns,
			limit: compiledQuery?.limit,
			offset: compiledQuery?.offset,
			orderBy: compiledQuery?.orderBy,
		})

		// Record database query time
		recordDbQueryTime(metrics, dbStartTime)

		// Cache the result for future requests
		postListCache.set(cacheKey, data)

		// Finalize performance metrics
		const finalMetrics = finalize(metrics)

		// Log performance metrics for monitoring (including cache stats)
		c.var.logger.debug(
			`Post list query completed: ${JSON.stringify({
				requestId,
				parseTime: finalMetrics.queryParseTime?.toFixed(2),
				dbTime: finalMetrics.dbQueryTime?.toFixed(2),
				totalTime: finalMetrics.totalTime?.toFixed(2),
				resultCount: data.length,
				warningsCount: result.warnings.length,
				cacheStats: postListCache.getStats(),
			})}`,
		)

		// Log warnings for debugging (non-blocking)
		if (result.warnings.length > 0) {
			c.var.logger.debug(`Query warnings: ${JSON.stringify({ requestId, warnings: result.warnings })}`)
		}

		return c.json(data, HttpStatusCodes.OK)
	} catch (error) {
		const finalMetrics = finalize(metrics)
		const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

		c.var.logger.error(`Post list query failed: ${JSON.stringify({ requestId, error: errorMessage })}`)

		// Check if this is a database error vs query parsing error
		const isDatabaseError =
			errorMessage.includes("Failed query") ||
			errorMessage.includes("connection") ||
			errorMessage.includes("ECONNREFUSED") ||
			errorMessage.includes("database")

		if (isDatabaseError) {
			const queryError = createQueryError(
				"database",
				"INVALID_VALUE",
				"Database query failed. Please check database connection.",
				["database"],
			)

			const errorResponse = createErrorResponse(
				"Database error occurred",
				"DATABASE_ERROR",
				[queryError],
				[],
				["Check database connection", "Verify database is running"],
				requestId,
				finalMetrics.totalTime || 0,
			)

			return c.json(errorResponse, HttpStatusCodes.BAD_REQUEST)
		}

		const errorResponse = createMalformedQueryError(errorMessage, requestId, finalMetrics.totalTime || 0)
		return c.json(errorResponse, HttpStatusCodes.BAD_REQUEST)
	}
}

export const create: AppRouteHandler<BlogCreateRoute> = async (c) => {
	const requestId = crypto.randomUUID()
	const metrics = createPerformanceTracker()

	try {
		const validatedInput = c.req.valid("json")

		const slug = await generateUniqueSlug(validatedInput.title, db, post, post.slug)

		const dbStartTime = performance.now()

		const result = await db
			.insert(post)
			.values({
				title: validatedInput.title,
				content: validatedInput.content,
				published: validatedInput.published,
				thumbnailUrl: validatedInput.thumbnailUrl ?? null,
				slug,
			})
			.returning()

		const inserted = result[0]

		if (!inserted) {
			throw new Error("Failed to insert post - no result returned")
		}

		// Invalidate the post list cache since data has changed
		// Using invalidatePattern to clear all list queries
		const invalidatedCount = postListCache.invalidatePattern("/posts")

		recordDbQueryTime(metrics, dbStartTime)
		const finalMetrics = finalize(metrics)

		// Log successful creation with performance metrics
		c.var.logger.debug(
			`Post created successfully: ${JSON.stringify({
				requestId,
				postId: inserted.id,
				dbTime: finalMetrics.dbQueryTime?.toFixed(2),
				totalTime: finalMetrics.totalTime?.toFixed(2),
				cacheInvalidated: invalidatedCount,
			})}`,
		)

		return c.json(inserted, HttpStatusCodes.OK)
	} catch (error) {
		const finalMetrics = finalize(metrics)
		const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

		c.var.logger.error(`Post creation failed: ${JSON.stringify({ requestId, error: errorMessage })}`)

		// Return structured error for database/validation errors
		const queryError = createQueryError("post", "INVALID_VALUE", `Failed to create post: ${errorMessage}`, ["post"])

		const errorResponse = createErrorResponse(
			"Failed to create post",
			"CREATE_ERROR",
			[queryError],
			[],
			["Check that all required fields are provided", "Ensure the title is unique"],
			requestId,
			finalMetrics.totalTime || 0,
		)

		return c.json(errorResponse, HttpStatusCodes.BAD_REQUEST)
	}
}

export const getOne: AppRouteHandler<BlogGetOneRoute> = async (c) => {
	const requestId = crypto.randomUUID()
	const metrics = createPerformanceTracker()

	try {
		const { id, slug } = c.req.valid("param")

		// Use the new AST-based query builder with URL parsing for field selection
		const result = queryBuilder.executeFromUrl(c.req.url, post)

		// Record query parsing time
		recordParseTime(metrics)

		// If there are critical errors, return structured error response
		if (result.errors.length > 0) {
			const errorResponse = createValidationErrorResponse(
				toQueryErrors(result.errors),
				toQueryWarnings(result.warnings),
				requestId,
				metrics.queryParseTime || 0,
			)

			c.var.logger.warn(
				`Query validation failed for getOne: ${JSON.stringify({ requestId, errors: result.errors.length })}`,
			)

			return c.json(errorResponse, HttpStatusCodes.BAD_REQUEST)
		}

		// Execute database query with performance tracking
		// Query by both id AND slug for better security and SEO
		const dbStartTime = performance.now()

		const compiledQuery = result.query!

		const data = await db.query.post.findFirst({
			where: and(eq(post.id, id), eq(post.slug, slug)),
			columns: compiledQuery.columns,
		})

		recordDbQueryTime(metrics, dbStartTime)
		const finalMetrics = finalize(metrics)

		// Handle not found case
		if (!data) {
			c.var.logger.debug(`Post not found: ${JSON.stringify({ requestId, postId: id, slug })}`)
			return c.json({ message: "Blog post not found" }, HttpStatusCodes.NOT_FOUND)
		}

		// Log performance metrics
		c.var.logger.debug(
			`Post getOne completed: ${JSON.stringify({
				requestId,
				postId: id,
				slug,
				parseTime: finalMetrics.queryParseTime?.toFixed(2),
				dbTime: finalMetrics.dbQueryTime?.toFixed(2),
				totalTime: finalMetrics.totalTime?.toFixed(2),
				warningsCount: result.warnings.length,
			})}`,
		)

		// Log warnings for debugging
		if (result.warnings.length > 0) {
			c.var.logger.debug(`Query warnings: ${JSON.stringify({ requestId, warnings: result.warnings })}`)
		}

		return c.json(data, HttpStatusCodes.OK)
	} catch (error) {
		const finalMetrics = finalize(metrics)
		const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

		c.var.logger.error(`Post getOne failed: ${JSON.stringify({ requestId, error: errorMessage })}`)

		const errorResponse = createMalformedQueryError(errorMessage, requestId, finalMetrics.totalTime || 0)

		return c.json(errorResponse, HttpStatusCodes.BAD_REQUEST)
	}
}

export const search: AppRouteHandler<BlogSearchRoute> = async (c) => {
	const requestId = crypto.randomUUID()
	const metrics = createPerformanceTracker()

	try {
		// Get the search query from validated params (required field)
		const { q: searchQuery } = c.req.valid("query")

		// Use the new AST-based query builder with URL parsing
		// This handles QS bracket notation for filters automatically
		const result = queryBuilder.executeFromUrl(c.req.url, post)

		// Record query parsing time
		recordParseTime(metrics)

		// If there are critical errors, return structured error response
		if (result.errors.length > 0) {
			const errorResponse = createValidationErrorResponse(
				toQueryErrors(result.errors),
				toQueryWarnings(result.warnings),
				requestId,
				metrics.queryParseTime || 0,
			)

			c.var.logger.warn(
				`Search query validation failed: ${JSON.stringify({ requestId, errors: result.errors.length })}`,
			)

			return c.json(errorResponse, HttpStatusCodes.BAD_REQUEST)
		}

		// Execute database query with performance tracking
		const dbStartTime = performance.now()

		// Prepare search pattern for LIKE queries
		const searchPattern = `%${searchQuery.toLowerCase()}%`
		const compiledQuery = result.query!

		// Build the search condition using ilike for case-insensitive search
		const searchCondition = or(ilike(post.title, searchPattern), ilike(post.content, searchPattern))

		// Build the where clause combining published, search, and user-provided filters
		const baseCondition = and(eq(post.published, true), searchCondition)
		const whereCondition = compiledQuery.where ? and(baseCondition, compiledQuery.where) : baseCondition

		const data = await db.query.post.findMany({
			where: whereCondition,
			columns: compiledQuery.columns,
			limit: compiledQuery.limit,
			offset: compiledQuery.offset,
			orderBy: compiledQuery.orderBy.length > 0 ? compiledQuery.orderBy : undefined,
		})

		// Get total count for pagination
		const countResult = await db.query.post.findMany({
			where: whereCondition,
			columns: { id: true },
		})

		const total = countResult.length

		recordDbQueryTime(metrics, dbStartTime)
		const finalMetrics = finalize(metrics)

		// Log performance metrics
		c.var.logger.debug(
			`Post search completed: ${JSON.stringify({
				requestId,
				query: searchQuery,
				parseTime: finalMetrics.queryParseTime?.toFixed(2),
				dbTime: finalMetrics.dbQueryTime?.toFixed(2),
				totalTime: finalMetrics.totalTime?.toFixed(2),
				resultCount: data.length,
				total,
				warningsCount: result.warnings.length,
			})}`,
		)

		// Log warnings for debugging
		if (result.warnings.length > 0) {
			c.var.logger.debug(`Search query warnings: ${JSON.stringify({ requestId, warnings: result.warnings })}`)
		}

		return c.json(
			{
				data,
				total,
				query: searchQuery,
			},
			HttpStatusCodes.OK,
		)
	} catch (error) {
		const finalMetrics = finalize(metrics)
		const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

		c.var.logger.error(`Post search failed: ${JSON.stringify({ requestId, error: errorMessage })}`)

		const errorResponse = createMalformedQueryError(errorMessage, requestId, finalMetrics.totalTime || 0)

		return c.json(errorResponse, HttpStatusCodes.BAD_REQUEST)
	}
}

export const patch: AppRouteHandler<BlogPatchRoute> = async (c) => {
	const requestId = crypto.randomUUID()
	const metrics = createPerformanceTracker()

	try {
		const { id } = c.req.valid("param")
		const validatedInput = c.req.valid("json")

		recordParseTime(metrics)

		// Check if post exists first
		const dbStartTime = performance.now()

		const existingPost = await db.query.post.findFirst({
			where(fields, operators) {
				return operators.eq(fields.id, id)
			},
			columns: { id: true, slug: true, title: true },
		})

		if (!existingPost) {
			c.var.logger.debug(`Post not found for update: ${JSON.stringify({ requestId, postId: id })}`)
			return c.json({ message: "Blog post not found" }, HttpStatusCodes.NOT_FOUND)
		}

		// Prepare update values
		const updateValues: Record<string, any> = {}

		if (validatedInput.title !== undefined) {
			updateValues.title = validatedInput.title
			// Generate new slug if title changed
			if (validatedInput.title !== existingPost.title) {
				updateValues.slug = await generateUniqueSlug(validatedInput.title, db, post, post.slug)
			}
		}

		if (validatedInput.content !== undefined) {
			updateValues.content = validatedInput.content
		}

		if (validatedInput.published !== undefined) {
			updateValues.published = validatedInput.published
		}

		// Handle thumbnailUrl - allow setting to null to clear thumbnail
		if (validatedInput.thumbnailUrl !== undefined) {
			updateValues.thumbnailUrl = validatedInput.thumbnailUrl
		}

		// Update the post
		const result = await db
			.update(post)
			.set({
				...updateValues,
				updatedAt: new Date(),
			})
			.where(eq(post.id, id))
			.returning()

		const updated = result[0]

		if (!updated) {
			throw new Error("Failed to update post - no result returned")
		}

		// Invalidate the post list cache since data has changed
		const invalidatedCount = postListCache.invalidatePattern("/posts")

		recordDbQueryTime(metrics, dbStartTime)
		const finalMetrics = finalize(metrics)

		// Log successful update with performance metrics
		c.var.logger.debug(
			`Post updated successfully: ${JSON.stringify({
				requestId,
				postId: updated.id,
				dbTime: finalMetrics.dbQueryTime?.toFixed(2),
				totalTime: finalMetrics.totalTime?.toFixed(2),
				cacheInvalidated: invalidatedCount,
			})}`,
		)

		return c.json(updated, HttpStatusCodes.OK)
	} catch (error) {
		const finalMetrics = finalize(metrics)
		const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

		c.var.logger.error(`Post update failed: ${JSON.stringify({ requestId, error: errorMessage })}`)

		// Return structured error for database/validation errors
		const queryError = createQueryError("post", "INVALID_VALUE", `Failed to update post: ${errorMessage}`, ["post"])

		const errorResponse = createErrorResponse(
			"Failed to update post",
			"UPDATE_ERROR",
			[queryError],
			[],
			["Check that all fields have valid values", "Ensure the post ID exists"],
			requestId,
			finalMetrics.totalTime || 0,
		)

		return c.json(errorResponse, HttpStatusCodes.BAD_REQUEST)
	}
}

export const remove: AppRouteHandler<BlogRemoveRoute> = async (c) => {
	const requestId = crypto.randomUUID()
	const metrics = createPerformanceTracker()

	try {
		const { id } = c.req.valid("param")

		recordParseTime(metrics)

		const dbStartTime = performance.now()

		// Check if post exists first
		const existingPost = await db.query.post.findFirst({
			where(fields, operators) {
				return operators.eq(fields.id, id)
			},
			columns: { id: true },
		})

		if (!existingPost) {
			c.var.logger.debug(`Post not found for deletion: ${JSON.stringify({ requestId, postId: id })}`)
			return c.json({ message: "Blog post not found" }, HttpStatusCodes.NOT_FOUND)
		}

		// Delete the post
		await db.delete(post).where(eq(post.id, id))

		// Invalidate the post list cache since data has changed
		const invalidatedCount = postListCache.invalidatePattern("/posts")

		recordDbQueryTime(metrics, dbStartTime)
		const finalMetrics = finalize(metrics)

		// Log successful deletion with performance metrics
		c.var.logger.debug(
			`Post deleted successfully: ${JSON.stringify({
				requestId,
				postId: id,
				dbTime: finalMetrics.dbQueryTime?.toFixed(2),
				totalTime: finalMetrics.totalTime?.toFixed(2),
				cacheInvalidated: invalidatedCount,
			})}`,
		)

		return c.body(null, HttpStatusCodes.NO_CONTENT)
	} catch (error) {
		const finalMetrics = finalize(metrics)
		const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

		c.var.logger.error(`Post deletion failed: ${JSON.stringify({ requestId, error: errorMessage })}`)

		const queryError = createQueryError("post", "INVALID_VALUE", `Failed to delete post: ${errorMessage}`, ["post"])

		const errorResponse = createErrorResponse(
			"Failed to delete post",
			"DELETE_ERROR",
			[queryError],
			[],
			["Check that the post ID exists", "Ensure the ID format is valid"],
			requestId,
			finalMetrics.totalTime || 0,
		)

		return c.json(errorResponse, HttpStatusCodes.BAD_REQUEST)
	}
}
