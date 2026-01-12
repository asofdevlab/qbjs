/**
 * Query utilities for building API query parameters
 */

export type FilterOperator =
	| "eq"
	| "ne"
	| "lt"
	| "lte"
	| "gt"
	| "gte"
	| "in"
	| "notIn"
	| "contains"
	| "containsi"
	| "startsWith"
	| "between"
	| "null"
	| "notNull"

export type FilterValue = Record<FilterOperator, unknown>
export type Filter = Record<string, Partial<FilterValue>>

export interface QueryParams {
	page?: number
	limit?: number
	sort?: string
	fields?: string
	filter?: Filter
}

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
export function buildQuery(params?: QueryParams): Record<string, string> {
	const query: Record<string, string> = {}

	if (!params) return query

	if (params.page !== undefined) query.page = params.page.toString()
	if (params.limit !== undefined) query.limit = params.limit.toString()
	if (params.sort) query.sort = params.sort
	if (params.fields) query.fields = params.fields
	if (params.filter) query.filter = JSON.stringify(params.filter)

	return query
}

/**
 * Builds a search query object from params, including the required 'q' parameter
 */
export function buildSearchQuery(params: QueryParamsSearch): { q: string } & Record<string, string> {
	return {
		q: params.q,
		...buildQuery(params),
	}
}

/**
 * Helper to create filter conditions
 */
export const filter = {
	eq: <T>(value: T) => ({ eq: value }),
	ne: <T>(value: T) => ({ ne: value }),
	lt: <T>(value: T) => ({ lt: value }),
	lte: <T>(value: T) => ({ lte: value }),
	gt: <T>(value: T) => ({ gt: value }),
	gte: <T>(value: T) => ({ gte: value }),
	in: <T>(values: T[]) => ({ in: values }),
	notIn: <T>(values: T[]) => ({ notIn: values }),
	contains: (value: string) => ({ contains: value }),
	containsi: (value: string) => ({ containsi: value }),
	startsWith: (value: string) => ({ startsWith: value }),
	between: <T>(min: T, max: T) => ({ between: [min, max] }),
	isNull: () => ({ null: true }),
	isNotNull: () => ({ notNull: true }),
}
