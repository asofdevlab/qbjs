/**
 * Core Type Definitions for @qbjs/client
 *
 * These types align with @qbjs/core AST types to ensure compatibility
 * between client-side query building and server-side parsing.
 *
 * @module types
 */

/**
 * All filter operators supported by @qbjs/core.
 * These operators map to database-specific implementations in compilers.
 */
export type FilterOperator =
	| "eq"
	| "eqi"
	| "ne"
	| "nei"
	| "lt"
	| "lte"
	| "gt"
	| "gte"
	| "in"
	| "notIn"
	| "contains"
	| "containsi"
	| "notContains"
	| "notContainsi"
	| "startsWith"
	| "endsWith"
	| "null"
	| "notNull"
	| "between"

/**
 * Sort direction for ordering query results.
 */
export type SortDirection = "asc" | "desc"

/**
 * Logical operators for combining filter conditions.
 */
export type LogicalOperator = "and" | "or" | "not"

/**
 * A single filter condition on a field.
 * The key is the operator and the value is the comparison value.
 */
export interface FieldFilterCondition {
	[operator: string]: unknown
}

/**
 * Filter structure - can be field filters or logical combinations.
 * This recursive type allows for arbitrarily complex filter expressions.
 */
export type Filter = Record<string, FieldFilterCondition> | { and: Filter[] } | { or: Filter[] } | { not: Filter }

/**
 * Sort specification for a single field.
 */
export interface SortSpec {
	/** The field name to sort by */
	field: string
	/** The sort direction (ascending or descending) */
	direction: SortDirection
}

/**
 * Query parameters structure for building API queries.
 */
export interface QueryParams {
	/** Page number for pagination (1-indexed) */
	page?: number
	/** Number of items per page */
	limit?: number
	/** Sort specifications */
	sort?: SortSpec[]
	/** Fields to select */
	fields?: string[]
	/** Filter conditions */
	filter?: Filter
}

/**
 * Search query parameters (extends QueryParams with required q).
 */
export interface SearchQueryParams extends QueryParams {
	/** Search query string (required) */
	q: string
}

/**
 * Serialized output compatible with fetch APIs.
 * All values are strings for URL query parameter compatibility.
 */
export type SerializedQuery = Record<string, string>

/**
 * All supported filter operators as an array for validation.
 */
export const FILTER_OPERATORS: readonly FilterOperator[] = [
	"eq",
	"eqi",
	"ne",
	"nei",
	"lt",
	"lte",
	"gt",
	"gte",
	"in",
	"notIn",
	"contains",
	"containsi",
	"notContains",
	"notContainsi",
	"startsWith",
	"endsWith",
	"null",
	"notNull",
	"between",
] as const

/**
 * All supported logical operators as an array for validation.
 */
export const LOGICAL_OPERATORS: readonly LogicalOperator[] = ["and", "or", "not"] as const

/**
 * All supported sort directions as an array for validation.
 */
export const SORT_DIRECTIONS: readonly SortDirection[] = ["asc", "desc"] as const
