/**
 * Serializer Module for @qbjs/client
 *
 * This module provides functions to serialize QueryParams to URL-compatible
 * query strings using bracket notation compatible with @qbjs/core parser.
 *
 * @module serializer
 */

import type { Filter, QueryParams, SerializedQuery, SortSpec } from "./types"

/**
 * Maximum nesting depth for filter serialization to prevent stack overflow.
 */
const MAX_NESTING_DEPTH = 10

/**
 * Check if a value is a logical filter (and, or, not)
 * A logical filter has a single key that is "and", "or", or "not"
 * AND the value must be the correct type:
 * - "and" and "or" must have an array value
 * - "not" must have an object value (another filter)
 */
function isLogicalFilter(filter: Filter): filter is { and: Filter[] } | { or: Filter[] } | { not: Filter } {
	const keys = Object.keys(filter)
	if (keys.length !== 1) return false

	const key = keys[0]
	if (key === "and" || key === "or") {
		// For "and" and "or", the value must be an array
		return Array.isArray((filter as Record<string, unknown>)[key])
	}
	if (key === "not") {
		// For "not", the value must be an object (not an array, not null)
		const value = (filter as Record<string, unknown>)[key]
		return value !== null && typeof value === "object" && !Array.isArray(value)
	}
	return false
}

/**
 * Serialize a primitive value to a string for URL encoding.
 * Handles strings, numbers, booleans, and arrays.
 */
function serializeValue(value: unknown): string {
	if (value === null || value === undefined) {
		return ""
	}
	if (Array.isArray(value)) {
		return value.map((v) => String(v)).join(",")
	}
	return String(value)
}

/**
 * Recursively serialize a filter object to bracket notation key-value pairs.
 * Returns an array of [key, value] tuples.
 */
function serializeFilterRecursive(filter: Filter, prefix: string, depth: number): Array<[string, string]> {
	if (depth > MAX_NESTING_DEPTH) {
		throw new Error("Filter nesting depth exceeded maximum allowed depth")
	}

	const result: Array<[string, string]> = []

	// Handle logical operators (and, or, not)
	if (isLogicalFilter(filter)) {
		const keys = Object.keys(filter)
		const operator = keys[0] as "and" | "or" | "not"

		if (operator === "not") {
			const notFilter = (filter as { not: Filter }).not
			const nestedPairs = serializeFilterRecursive(notFilter, `${prefix}[not]`, depth + 1)
			result.push(...nestedPairs)
		} else {
			// and or or - array of filters
			const filters = (filter as { and: Filter[] } | { or: Filter[] })[operator]
			for (let i = 0; i < filters.length; i++) {
				const nestedPairs = serializeFilterRecursive(filters[i], `${prefix}[${operator}][${i}]`, depth + 1)
				result.push(...nestedPairs)
			}
		}
	} else {
		// Field filters: { fieldName: { operator: value } }
		for (const [fieldName, conditions] of Object.entries(filter)) {
			if (conditions === null || conditions === undefined) {
				continue
			}

			// conditions is FieldFilterCondition: { operator: value }
			for (const [operator, value] of Object.entries(conditions)) {
				if (value === null || value === undefined) {
					continue
				}

				const key = `${prefix}[${fieldName}][${operator}]`

				// Handle array values (for 'in', 'notIn', 'between')
				if (Array.isArray(value)) {
					for (let i = 0; i < value.length; i++) {
						result.push([`${key}[${i}]`, serializeValue(value[i])])
					}
				} else {
					result.push([key, serializeValue(value)])
				}
			}
		}
	}

	return result
}

/**
 * Serialize a filter object to qs-compatible bracket notation.
 *
 * @param filter - Filter object to serialize
 * @returns Query string fragment for the filter (without leading &)
 *
 * @example
 * serializeFilter({ title: { eq: "hello" } })
 * // Returns: "filter[title][eq]=hello"
 *
 * serializeFilter({ and: [{ status: { eq: "active" } }, { role: { eq: "admin" } }] })
 * // Returns: "filter[and][0][status][eq]=active&filter[and][1][role][eq]=admin"
 */
export function serializeFilter(filter: Filter): string {
	const pairs = serializeFilterRecursive(filter, "filter", 0)
	return pairs.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")
}

/**
 * Serialize sort specifications to string format.
 *
 * @param sort - Array of sort specifications
 * @returns Sort string in format "field1:dir1,field2:dir2"
 *
 * @example
 * serializeSort([{ field: "name", direction: "asc" }])
 * // Returns: "name:asc"
 *
 * serializeSort([{ field: "name", direction: "asc" }, { field: "date", direction: "desc" }])
 * // Returns: "name:asc,date:desc"
 */
export function serializeSort(sort: SortSpec[]): string {
	if (!sort || sort.length === 0) return ""
	return sort.map((s) => `${s.field}:${s.direction || "asc"}`).join(",")
}

/**
 * Serialize field names to comma-separated string.
 * Deduplicates field names in the output.
 *
 * @param fields - Array of field names
 * @returns Comma-separated string of unique field names
 *
 * @example
 * serializeFields(["id", "name", "email"])
 * // Returns: "id,name,email"
 *
 * serializeFields(["id", "name", "id"])
 * // Returns: "id,name"
 */
export function serializeFields(fields: string[]): string {
	if (!fields || fields.length === 0) return ""
	const unique = [...new Set(fields)]
	return unique.join(",")
}

/**
 * Serialize QueryParams to a SerializedQuery object.
 * All values are converted to strings for URL compatibility.
 *
 * @param params - Query parameters to serialize
 * @returns Object with string keys and string values
 *
 * @example
 * serialize({ page: 1, limit: 10, filter: { status: { eq: "active" } } })
 * // Returns: { page: "1", limit: "10", filter: "filter[status][eq]=active" }
 */
export function serialize(params: QueryParams): SerializedQuery {
	const result: SerializedQuery = {}

	if (!params) return result

	if (params.page !== undefined) {
		result.page = String(params.page)
	}

	if (params.limit !== undefined) {
		result.limit = String(params.limit)
	}

	if (params.sort && params.sort.length > 0) {
		result.sort = serializeSort(params.sort)
	}

	if (params.fields && params.fields.length > 0) {
		result.fields = serializeFields(params.fields)
	}

	if (params.filter) {
		// For the SerializedQuery, we store the raw filter string
		// This is different from toQueryString which produces URL-ready output
		result.filter = JSON.stringify(params.filter)
	}

	return result
}

/**
 * Serialize QueryParams to a URL-ready query string.
 * Uses bracket notation for filters compatible with @qbjs/core parser.
 *
 * @param params - Query parameters to serialize
 * @returns URL-encoded query string (without leading ?)
 *
 * @example
 * toQueryString({ page: 1, limit: 10, filter: { status: { eq: "active" } } })
 * // Returns: "page=1&limit=10&filter[status][eq]=active"
 */
export function toQueryString(params: QueryParams): string {
	if (!params) return ""

	const parts: string[] = []

	if (params.page !== undefined) {
		parts.push(`page=${encodeURIComponent(String(params.page))}`)
	}

	if (params.limit !== undefined) {
		parts.push(`limit=${encodeURIComponent(String(params.limit))}`)
	}

	if (params.sort && params.sort.length > 0) {
		parts.push(`sort=${encodeURIComponent(serializeSort(params.sort))}`)
	}

	if (params.fields && params.fields.length > 0) {
		parts.push(`fields=${encodeURIComponent(serializeFields(params.fields))}`)
	}

	if (params.filter) {
		// Use bracket notation for filters
		parts.push(serializeFilter(params.filter))
	}

	return parts.join("&")
}
