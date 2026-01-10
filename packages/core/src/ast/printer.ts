/**
 * AST Pretty Printer for @qbjs/core
 *
 * This module provides functions to convert a QueryAST back into
 * a QS-compatible query string format. This enables round-trip
 * parsing and debugging.
 *
 * @module ast/printer
 */

import type { FilterNode, Pagination, QueryAST, SortSpec } from "./types";
import { isFieldFilter, isLogicalFilter } from "./types";

/**
 * Convert a field array to a comma-separated string.
 *
 * @param fields - Array of field names or null
 * @returns Comma-separated field string or undefined if null/empty
 *
 * @example
 * printFields(["id", "name", "email"]) // "id,name,email"
 * printFields(null) // undefined
 */
export function printFields(fields: string[] | null): string | undefined {
	if (!fields || fields.length === 0) {
		return undefined;
	}
	return fields.join(",");
}

/**
 * Convert offset/limit pagination to page/limit parameters.
 *
 * @param pagination - Pagination object with offset and limit
 * @returns Object with page and limit, or undefined values if defaults
 *
 * @example
 * printPagination({ offset: 10, limit: 10 }) // { page: 2, limit: 10 }
 * printPagination({ offset: 0, limit: 10 }) // { page: 1, limit: 10 }
 */
export function printPagination(pagination: Pagination): { page: number; limit: number } {
	const page = Math.floor(pagination.offset / pagination.limit) + 1;
	return { page, limit: pagination.limit };
}

/**
 * Convert a SortSpec array to a sort string.
 *
 * @param sort - Array of SortSpec objects
 * @returns Sort string (e.g., "createdAt:desc,name:asc") or undefined if empty
 *
 * @example
 * printSort([{ field: "createdAt", direction: "desc" }]) // "createdAt:desc"
 * printSort([]) // undefined
 */
export function printSort(sort: SortSpec[]): string | undefined {
	if (!sort || sort.length === 0) {
		return undefined;
	}
	return sort.map((s) => `${s.field}:${s.direction}`).join(",");
}

/**
 * Convert a FilterNode to a QS-compatible filter object.
 *
 * @param filter - FilterNode or null
 * @returns QS filter object or undefined if null
 *
 * @example
 * printFilter({ type: "field", field: "title", operator: "eq", value: "hello" })
 * // { title: { eq: "hello" } }
 *
 * printFilter({
 *   type: "logical",
 *   operator: "and",
 *   conditions: [
 *     { type: "field", field: "title", operator: "eq", value: "hello" },
 *     { type: "field", field: "status", operator: "eq", value: "active" }
 *   ]
 * })
 * // { and: [{ title: { eq: "hello" } }, { status: { eq: "active" } }] }
 */
export function printFilter(filter: FilterNode | null): Record<string, unknown> | undefined {
	if (!filter) {
		return undefined;
	}

	if (isFieldFilter(filter)) {
		return {
			[filter.field]: {
				[filter.operator]: filter.value,
			},
		};
	}

	if (isLogicalFilter(filter)) {
		const conditions = filter.conditions.map((c) => printFilter(c)).filter((c) => c !== undefined);

		if (conditions.length === 0) {
			return undefined;
		}

		return {
			[filter.operator]: conditions,
		};
	}

	return undefined;
}

/**
 * Query parameters output from the print function
 */
export interface PrintedQuery {
	/** Comma-separated field names */
	fields?: string;
	/** Page number (1-based) */
	page?: number;
	/** Number of items per page */
	limit?: number;
	/** Sort specification string */
	sort?: string;
	/** Filter object in QS format */
	filter?: Record<string, unknown>;
}

/**
 * Convert a QueryAST to a QS-compatible query parameters object.
 *
 * This is the main entry point for printing an AST back to query parameters.
 *
 * @param ast - The QueryAST to print
 * @returns PrintedQuery object with query parameters
 *
 * @example
 * const ast = {
 *   fields: ["id", "name"],
 *   pagination: { offset: 10, limit: 10 },
 *   sort: [{ field: "createdAt", direction: "desc" }],
 *   filter: { type: "field", field: "status", operator: "eq", value: "active" }
 * };
 * print(ast)
 * // {
 * //   fields: "id,name",
 * //   page: 2,
 * //   limit: 10,
 * //   sort: "createdAt:desc",
 * //   filter: { status: { eq: "active" } }
 * // }
 */
export function print(ast: QueryAST): PrintedQuery {
	const result: PrintedQuery = {};

	const fields = printFields(ast.fields);
	if (fields !== undefined) {
		result.fields = fields;
	}

	const { page, limit } = printPagination(ast.pagination);
	result.page = page;
	result.limit = limit;

	const sort = printSort(ast.sort);
	if (sort !== undefined) {
		result.sort = sort;
	}

	const filter = printFilter(ast.filter);
	if (filter !== undefined) {
		result.filter = filter;
	}

	return result;
}

/**
 * Convert a QueryAST to a URL query string.
 *
 * @param ast - The QueryAST to print
 * @returns URL-encoded query string
 *
 * @example
 * printQueryString(ast) // "fields=id,name&page=2&limit=10&sort=createdAt:desc"
 */
export function printQueryString(ast: QueryAST): string {
	const params = new URLSearchParams();
	const printed = print(ast);

	if (printed.fields) {
		params.set("fields", printed.fields);
	}

	if (printed.page !== undefined) {
		params.set("page", String(printed.page));
	}

	if (printed.limit !== undefined) {
		params.set("limit", String(printed.limit));
	}

	if (printed.sort) {
		params.set("sort", printed.sort);
	}

	if (printed.filter) {
		// For complex filters, we serialize as JSON
		// Full QS serialization would be done by the caller using qs library
		params.set("filter", JSON.stringify(printed.filter));
	}

	return params.toString();
}
