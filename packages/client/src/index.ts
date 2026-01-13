/**
 * Query utilities for building API query parameters
 */

// Re-export serializer functions
export {
	serialize,
	serializeFilter,
	toQueryString,
} from "./serializer"
// Re-export all types from the types module
export type {
	FieldFilterCondition,
	Filter,
	FilterOperator,
	LogicalOperator,
	QueryParams,
	SearchQueryParams,
	SerializedQuery,
	SortDirection,
	SortSpec,
} from "./types"
export {
	FILTER_OPERATORS,
	LOGICAL_OPERATORS,
	SORT_DIRECTIONS,
} from "./types"

// Import serializer for internal use
import { toQueryString as serializerToQueryString } from "./serializer"
// Import types for internal use
import type {
	Filter,
	FilterOperator,
	QueryParams,
	SearchQueryParams,
	SerializedQuery,
	SortDirection,
	SortSpec,
} from "./types"

/**
 * Immutable query builder with fluent API.
 * Each method returns a new instance, preserving immutability.
 */
export class QueryBuilder<TFields extends string = string> {
	private readonly params: QueryParams

	constructor(params?: QueryParams) {
		this.params = params ? { ...params } : {}
	}

	// Pagination methods
	page(page: number): QueryBuilder<TFields> {
		return new QueryBuilder({ ...this.params, page })
	}

	limit(limit: number): QueryBuilder<TFields> {
		return new QueryBuilder({ ...this.params, limit })
	}

	paginate(page: number, limit: number): QueryBuilder<TFields> {
		return new QueryBuilder({ ...this.params, page, limit })
	}

	// Sorting methods
	sort(field: TFields, direction: SortDirection = "asc"): QueryBuilder<TFields> {
		const newSort: SortSpec[] = [...(this.params.sort || []), { field, direction }]
		return new QueryBuilder({ ...this.params, sort: newSort })
	}

	sortAsc(field: TFields): QueryBuilder<TFields> {
		return this.sort(field, "asc")
	}

	sortDesc(field: TFields): QueryBuilder<TFields> {
		return this.sort(field, "desc")
	}

	// Field selection methods
	fields(...fields: TFields[]): QueryBuilder<TFields> {
		const existingFields = this.params.fields || []
		const newFields = [...new Set([...existingFields, ...fields])]
		return new QueryBuilder({ ...this.params, fields: newFields })
	}

	select(...fields: TFields[]): QueryBuilder<TFields> {
		return this.fields(...fields)
	}

	// Filtering methods
	filter(filter: Filter): QueryBuilder<TFields> {
		return new QueryBuilder({ ...this.params, filter })
	}

	where(field: TFields, operator: FilterOperator, value: unknown): QueryBuilder<TFields> {
		const condition = { [field]: { [operator]: value } }
		const existingFilter = this.params.filter

		if (!existingFilter) {
			return new QueryBuilder({ ...this.params, filter: condition })
		}

		// Combine with existing filter using AND
		if ("and" in existingFilter && Array.isArray((existingFilter as { and: Filter[] }).and)) {
			return new QueryBuilder({
				...this.params,
				filter: { and: [...(existingFilter as { and: Filter[] }).and, condition] },
			})
		}

		return new QueryBuilder({
			...this.params,
			filter: { and: [existingFilter, condition] },
		})
	}

	and(...filters: Filter[]): QueryBuilder<TFields> {
		const existingFilter = this.params.filter
		if (!existingFilter) {
			return new QueryBuilder({ ...this.params, filter: { and: filters } })
		}
		return new QueryBuilder({
			...this.params,
			filter: { and: [existingFilter, ...filters] },
		})
	}

	or(...filters: Filter[]): QueryBuilder<TFields> {
		const existingFilter = this.params.filter
		if (!existingFilter) {
			return new QueryBuilder({ ...this.params, filter: { or: filters } })
		}
		return new QueryBuilder({
			...this.params,
			filter: { or: [existingFilter, ...filters] },
		})
	}

	not(filter: Filter): QueryBuilder<TFields> {
		return new QueryBuilder({ ...this.params, filter: { not: filter } })
	}

	// Build methods
	build(): SerializedQuery {
		return buildQuery(this.params)
	}

	toQueryString(): string {
		return serializerToQueryString(this.params)
	}

	toParams(): QueryParams {
		return { ...this.params }
	}

	// Query key for React Query
	toQueryKey(prefix: string[] = []): unknown[] {
		return createQueryKey(prefix, this.params)
	}
}

/**
 * Create a new query builder instance.
 * Convenience function for starting a query chain.
 */
export function query<TFields extends string = string>(): QueryBuilder<TFields> {
	return new QueryBuilder<TFields>()
}

/**
 * @deprecated Use Filter from types instead
 */
export type FilterValue = Record<string, unknown>

/**
 * @deprecated Use SearchQueryParams instead
 */
export interface QueryParamsSearch {
	q: string
	page?: number
	limit?: number
	sort?: string
	fields?: string
	filter?: Filter
}

/**
 * Builds a query object from params, only including defined values
 */
export function buildQuery(params?: QueryParams): SerializedQuery {
	const query: SerializedQuery = {}

	if (!params) return query

	if (params.page !== undefined) query.page = params.page.toString()
	if (params.limit !== undefined) query.limit = params.limit.toString()
	if (params.sort && params.sort.length > 0) {
		query.sort = params.sort.map((s) => `${s.field}:${s.direction}`).join(",")
	}
	if (params.fields && params.fields.length > 0) {
		query.fields = params.fields.join(",")
	}
	if (params.filter) query.filter = JSON.stringify(params.filter)

	return query
}

/**
 * Builds a search query object from params, including the required 'q' parameter
 */
export function buildSearchQuery(params: SearchQueryParams): { q: string } & SerializedQuery {
	return {
		q: params.q,
		...buildQuery(params),
	}
}

/**
 * Serialize sort specifications to string format.
 * Example: [{ field: "name", direction: "asc" }] -> "name:asc"
 * Multiple sorts: [{ field: "name", direction: "asc" }, { field: "date", direction: "desc" }] -> "name:asc,date:desc"
 */
export function serializeSort(sort: SortSpec[]): string {
	if (!sort || sort.length === 0) return ""
	return sort.map((s) => `${s.field}:${s.direction || "asc"}`).join(",")
}

/**
 * Serialize field names to comma-separated string.
 * Deduplicates field names in the output.
 * Example: ["id", "name", "email"] -> "id,name,email"
 */
export function serializeFields(fields: string[]): string {
	if (!fields || fields.length === 0) return ""
	const unique = [...new Set(fields)]
	return unique.join(",")
}

/**
 * Helper to create filter conditions.
 * Provides type-safe factory functions for all filter operators.
 */
export const filter = {
	// Equality operators
	eq: <T>(value: T) => ({ eq: value }),
	eqi: (value: string) => ({ eqi: value }),
	ne: <T>(value: T) => ({ ne: value }),
	nei: (value: string) => ({ nei: value }),

	// Comparison operators
	lt: <T>(value: T) => ({ lt: value }),
	lte: <T>(value: T) => ({ lte: value }),
	gt: <T>(value: T) => ({ gt: value }),
	gte: <T>(value: T) => ({ gte: value }),

	// Array operators
	in: <T>(values: T[]) => ({ in: values }),
	notIn: <T>(values: T[]) => ({ notIn: values }),

	// String operators
	contains: (value: string) => ({ contains: value }),
	containsi: (value: string) => ({ containsi: value }),
	notContains: (value: string) => ({ notContains: value }),
	notContainsi: (value: string) => ({ notContainsi: value }),
	startsWith: (value: string) => ({ startsWith: value }),
	endsWith: (value: string) => ({ endsWith: value }),

	// Range operator
	between: <T>(min: T, max: T) => ({ between: [min, max] }),

	// Null check operators
	isNull: () => ({ null: true }),
	isNotNull: () => ({ notNull: true }),

	// Logical combinators
	and: (...filters: Filter[]) => ({ and: filters }),
	or: (...filters: Filter[]) => ({ or: filters }),
	not: (filter: Filter) => ({ not: filter }),
}

/**
 * Alias for filter helper - provides a shorter name for concise usage.
 * Example: f.eq("value") instead of filter.eq("value")
 */
export const f = filter

// ============================================================================
// Pagination Helpers
// ============================================================================

/**
 * Calculate the next page number.
 * @param currentPage - The current page number
 * @returns The next page number (currentPage + 1)
 */
export function nextPage(currentPage: number): number {
	return currentPage + 1
}

/**
 * Calculate the previous page number with a minimum of 1.
 * @param currentPage - The current page number
 * @returns The previous page number, minimum of 1
 */
export function prevPage(currentPage: number): number {
	return Math.max(1, currentPage - 1)
}

/**
 * Calculate the offset from page number and limit.
 * @param page - The page number (1-indexed)
 * @param limit - The number of items per page
 * @returns The offset for database queries
 */
export function calculateOffset(page: number, limit: number): number {
	return (page - 1) * limit
}

// ============================================================================
// Query Key Generation
// ============================================================================

/**
 * Normalize an object to ensure deterministic JSON serialization.
 * Sorts object keys alphabetically and recursively normalizes nested objects.
 */
function normalizeForQueryKey(value: unknown): unknown {
	if (value === null || value === undefined) {
		return value
	}

	if (Array.isArray(value)) {
		return value.map(normalizeForQueryKey)
	}

	if (typeof value === "object") {
		const sorted: Record<string, unknown> = {}
		const keys = Object.keys(value as Record<string, unknown>).sort()
		for (const key of keys) {
			sorted[key] = normalizeForQueryKey((value as Record<string, unknown>)[key])
		}
		return sorted
	}

	return value
}

/**
 * Generate a stable, JSON-serializable query key for React Query.
 * The key is deterministic - same inputs always produce identical outputs.
 *
 * @param prefix - Array of strings to prefix the key (e.g., ['posts', 'list'])
 * @param params - Optional query parameters to include in the key
 * @returns An array suitable for use as a React Query key
 */
export function createQueryKey(prefix: string[], params?: QueryParams): unknown[] {
	if (!params || Object.keys(params).length === 0) {
		return [...prefix]
	}

	// Normalize params to ensure deterministic output
	const normalizedParams = normalizeForQueryKey(params)

	return [...prefix, normalizedParams]
}

// ============================================================================
// Print/Parse Utilities
// ============================================================================

/**
 * Print QueryParams to a human-readable query string format.
 * Useful for debugging and logging queries.
 *
 * @param params - The query parameters to print
 * @returns A URL-encoded query string representation
 */
export function printQuery(params: QueryParams): string {
	const parts: string[] = []

	if (params.page !== undefined) {
		parts.push(`page=${encodeURIComponent(params.page.toString())}`)
	}

	if (params.limit !== undefined) {
		parts.push(`limit=${encodeURIComponent(params.limit.toString())}`)
	}

	if (params.sort && params.sort.length > 0) {
		const sortStr = params.sort.map((s) => `${s.field}:${s.direction}`).join(",")
		parts.push(`sort=${encodeURIComponent(sortStr)}`)
	}

	if (params.fields && params.fields.length > 0) {
		parts.push(`fields=${encodeURIComponent(params.fields.join(","))}`)
	}

	if (params.filter) {
		parts.push(`filter=${encodeURIComponent(JSON.stringify(params.filter))}`)
	}

	return parts.join("&")
}

/**
 * Parse a query string back to QueryParams.
 * Useful for debugging and testing round-trip consistency.
 *
 * @param queryString - The query string to parse (with or without leading '?')
 * @returns The parsed QueryParams object
 */
export function parseQuery(queryString: string): QueryParams {
	const params: QueryParams = {}

	// Remove leading '?' if present
	const cleanQuery = queryString.startsWith("?") ? queryString.slice(1) : queryString

	if (!cleanQuery) {
		return params
	}

	const pairs = cleanQuery.split("&")

	for (const pair of pairs) {
		const [key, encodedValue] = pair.split("=")
		if (!key || encodedValue === undefined) continue

		const value = decodeURIComponent(encodedValue)

		switch (key) {
			case "page":
				params.page = Number.parseInt(value, 10)
				break

			case "limit":
				params.limit = Number.parseInt(value, 10)
				break

			case "sort":
				params.sort = value.split(",").map((s) => {
					const [field, direction] = s.split(":")
					return {
						field,
						direction: (direction as SortDirection) || "asc",
					}
				})
				break

			case "fields":
				params.fields = value.split(",")
				break

			case "filter":
				try {
					params.filter = JSON.parse(value) as Filter
				} catch {
					// Invalid JSON, skip filter
				}
				break
		}
	}

	return params
}
