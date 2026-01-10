/**
 * AST Parser for @qbjs/core
 *
 * This module provides functions to parse QS-formatted query strings into
 * a stable AST representation. The parser is ORM-agnostic and database-agnostic.
 *
 * @module ast/parser
 */

import qs from "qs";
import type {
	FieldFilter,
	FilterNode,
	FilterOperator,
	LogicalFilter,
	LogicalOperator,
	Pagination,
	QueryAST,
	SortDirection,
	SortSpec,
} from "./types";
import { FILTER_OPERATORS, LOGICAL_OPERATORS, SORT_DIRECTIONS } from "./types";

/**
 * Parse error returned when parsing fails
 */
export interface ParseError {
	code: "INVALID_FIELD" | "INVALID_OPERATOR" | "INVALID_VALUE" | "EXCEEDED_LIMIT" | "SECURITY_VIOLATION";
	field: string;
	message: string;
	path: string[];
}

/**
 * Parse warning returned for non-fatal issues
 */
export interface ParseWarning {
	code: "FIELD_IGNORED" | "LIMIT_CAPPED" | "DEFAULT_APPLIED";
	field: string;
	message: string;
	suggestion?: string;
}

/**
 * Result of parsing a query string
 */
export interface ParserResult {
	ast: QueryAST | null;
	errors: ParseError[];
	warnings: ParseWarning[];
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGINATION: Pagination = {
	offset: 0,
	limit: 10,
};

/**
 * Default page number
 */
export const DEFAULT_PAGE = 1;

/**
 * Parse a comma-separated fields string into an array of field names.
 *
 * @param fieldsParam - Comma-separated field names (e.g., "id,name,email")
 * @returns Array of field names or null if no fields specified
 *
 * @example
 * parseFields("id,name,email") // ["id", "name", "email"]
 * parseFields("") // null
 * parseFields(undefined) // null
 */
export function parseFields(fieldsParam: string | undefined | null): string[] | null {
	if (!fieldsParam || typeof fieldsParam !== "string") {
		return null;
	}

	const trimmed = fieldsParam.trim();
	if (trimmed === "") {
		return null;
	}

	const fields = trimmed
		.split(",")
		.map((f) => f.trim())
		.filter((f) => f.length > 0);

	return fields.length > 0 ? fields : null;
}

/**
 * Parse page and limit parameters into offset-based pagination.
 *
 * @param pageParam - Page number (1-based)
 * @param limitParam - Number of items per page
 * @returns Pagination object with offset and limit
 *
 * @example
 * parsePagination("2", "10") // { offset: 10, limit: 10 }
 * parsePagination(undefined, undefined) // { offset: 0, limit: 10 }
 */
export function parsePagination(
	pageParam: string | number | undefined | null,
	limitParam: string | number | undefined | null,
): Pagination {
	// Parse limit
	let limit = DEFAULT_PAGINATION.limit;
	if (limitParam !== undefined && limitParam !== null) {
		const parsedLimit = typeof limitParam === "number" ? limitParam : Number.parseInt(String(limitParam), 10);
		if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
			limit = parsedLimit;
		}
	}

	// Parse page and calculate offset
	let page = DEFAULT_PAGE;
	if (pageParam !== undefined && pageParam !== null) {
		const parsedPage = typeof pageParam === "number" ? pageParam : Number.parseInt(String(pageParam), 10);
		if (!Number.isNaN(parsedPage) && parsedPage > 0) {
			page = parsedPage;
		}
	}

	const offset = (page - 1) * limit;

	return { offset, limit };
}

/**
 * Parse a sort string into an array of SortSpec objects.
 *
 * @param sortParam - Sort string (e.g., "createdAt:desc,name:asc" or "createdAt:desc")
 * @returns Array of SortSpec objects
 *
 * @example
 * parseSort("createdAt:desc") // [{ field: "createdAt", direction: "desc" }]
 * parseSort("name:asc,createdAt:desc") // [{ field: "name", direction: "asc" }, { field: "createdAt", direction: "desc" }]
 * parseSort("name") // [{ field: "name", direction: "asc" }]
 */
export function parseSort(sortParam: string | undefined | null): SortSpec[] {
	if (!sortParam || typeof sortParam !== "string") {
		return [];
	}

	const trimmed = sortParam.trim();
	if (trimmed === "") {
		return [];
	}

	const sortSpecs: SortSpec[] = [];
	const parts = trimmed.split(",");

	for (const part of parts) {
		const trimmedPart = part.trim();
		if (trimmedPart === "") {
			continue;
		}

		const colonIndex = trimmedPart.lastIndexOf(":");
		let field: string;
		let direction: SortDirection = "asc";

		if (colonIndex === -1) {
			// No direction specified, default to asc
			field = trimmedPart;
		} else {
			field = trimmedPart.substring(0, colonIndex).trim();
			const directionStr = trimmedPart
				.substring(colonIndex + 1)
				.trim()
				.toLowerCase();

			if (SORT_DIRECTIONS.includes(directionStr as SortDirection)) {
				direction = directionStr as SortDirection;
			}
			// If invalid direction, keep default "asc"
		}

		if (field.length > 0) {
			sortSpecs.push({ field, direction });
		}
	}

	return sortSpecs;
}

/**
 * Check if a string is a valid filter operator
 */
function isValidFilterOperator(op: string): op is FilterOperator {
	return FILTER_OPERATORS.includes(op as FilterOperator);
}

/**
 * Check if a string is a valid logical operator
 */
function isValidLogicalOperator(op: string): op is LogicalOperator {
	return LOGICAL_OPERATORS.includes(op as LogicalOperator);
}

/**
 * Parse a filter object from QS format into a FilterNode.
 *
 * QS filter format examples:
 * - filter[title][eq]=hello -> { title: { eq: "hello" } }
 * - filter[age][gt]=18 -> { age: { gt: "18" } }
 * - filter[and][0][title][eq]=hello&filter[and][1][status][eq]=active
 *   -> { and: [{ title: { eq: "hello" } }, { status: { eq: "active" } }] }
 *
 * @param filterObj - Parsed QS filter object
 * @param errors - Array to collect parse errors
 * @param path - Current path for error reporting
 * @returns FilterNode or null if no valid filter
 */
export function parseFilter(
	filterObj: unknown,
	errors: ParseError[] = [],
	path: string[] = ["filter"],
): FilterNode | null {
	if (filterObj === null || filterObj === undefined) {
		return null;
	}

	if (typeof filterObj !== "object") {
		errors.push({
			code: "INVALID_VALUE",
			field: path.join("."),
			message: "Filter must be an object",
			path,
		});
		return null;
	}

	const obj = filterObj as Record<string, unknown>;
	const keys = Object.keys(obj);

	if (keys.length === 0) {
		return null;
	}

	// Check if this is a logical operator (and, or, not)
	const firstKey = keys[0];
	if (keys.length === 1 && firstKey && isValidLogicalOperator(firstKey)) {
		return parseLogicalFilter(firstKey as LogicalOperator, obj[firstKey], errors, [...path, firstKey]);
	}

	// Check if we have multiple field filters - combine with AND
	if (keys.length > 1) {
		const conditions: FilterNode[] = [];
		for (const key of keys) {
			if (isValidLogicalOperator(key)) {
				const logicalFilter = parseLogicalFilter(key as LogicalOperator, obj[key], errors, [...path, key]);
				if (logicalFilter) {
					conditions.push(logicalFilter);
				}
			} else {
				const fieldFilter = parseFieldFilterFromObject(key, obj[key], errors, [...path, key]);
				if (fieldFilter) {
					conditions.push(fieldFilter);
				}
			}
		}

		if (conditions.length === 0) {
			return null;
		}
		if (conditions.length === 1) {
			return conditions[0] ?? null;
		}

		return {
			type: "logical",
			operator: "and",
			conditions,
		};
	}

	// Single field filter
	const fieldName = keys[0];
	if (!fieldName) {
		return null;
	}
	return parseFieldFilterFromObject(fieldName, obj[fieldName], errors, [...path, fieldName]);
}

/**
 * Parse a logical filter (and, or, not)
 */
function parseLogicalFilter(
	operator: LogicalOperator,
	value: unknown,
	errors: ParseError[],
	path: string[],
): LogicalFilter | null {
	if (value === null || value === undefined) {
		return null;
	}

	// Handle array of conditions
	if (Array.isArray(value)) {
		const conditions: FilterNode[] = [];
		for (let i = 0; i < value.length; i++) {
			const condition = parseFilter(value[i], errors, [...path, String(i)]);
			if (condition) {
				conditions.push(condition);
			}
		}

		if (conditions.length === 0) {
			return null;
		}

		return {
			type: "logical",
			operator,
			conditions,
		};
	}

	// Handle object with indexed keys (QS array format: { "0": {...}, "1": {...} })
	if (typeof value === "object") {
		const obj = value as Record<string, unknown>;
		const keys = Object.keys(obj);

		// Check if all keys are numeric (array-like object from QS)
		const isArrayLike = keys.every((k) => /^\d+$/.test(k));

		if (isArrayLike && keys.length > 0) {
			const conditions: FilterNode[] = [];
			const sortedKeys = keys.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));

			for (const key of sortedKeys) {
				const condition = parseFilter(obj[key], errors, [...path, key]);
				if (condition) {
					conditions.push(condition);
				}
			}

			if (conditions.length === 0) {
				return null;
			}

			return {
				type: "logical",
				operator,
				conditions,
			};
		}

		// Single nested filter object
		const condition = parseFilter(value, errors, path);
		if (condition) {
			return {
				type: "logical",
				operator,
				conditions: [condition],
			};
		}
	}

	errors.push({
		code: "INVALID_VALUE",
		field: path.join("."),
		message: `Logical operator "${operator}" requires an array or object of conditions`,
		path,
	});

	return null;
}

/**
 * Parse a field filter from an object like { eq: "value" } or { gt: 10 }
 */
function parseFieldFilterFromObject(
	fieldName: string,
	value: unknown,
	errors: ParseError[],
	path: string[],
): FilterNode | null {
	if (value === null || value === undefined) {
		return null;
	}

	if (typeof value !== "object" || Array.isArray(value)) {
		// Direct value without operator - assume "eq"
		return {
			type: "field",
			field: fieldName,
			operator: "eq",
			value: value,
		};
	}

	const obj = value as Record<string, unknown>;
	const operators = Object.keys(obj);

	if (operators.length === 0) {
		return null;
	}

	// If multiple operators on same field, combine with AND
	if (operators.length > 1) {
		const conditions: FieldFilter[] = [];
		for (const op of operators) {
			if (isValidFilterOperator(op)) {
				conditions.push({
					type: "field",
					field: fieldName,
					operator: op,
					value: obj[op],
				});
			} else {
				errors.push({
					code: "INVALID_OPERATOR",
					field: path.join("."),
					message: `Invalid filter operator: "${op}"`,
					path: [...path, op],
				});
			}
		}

		if (conditions.length === 0) {
			return null;
		}
		if (conditions.length === 1) {
			return conditions[0] ?? null;
		}

		// Return as logical AND of multiple conditions on same field
		return {
			type: "logical",
			operator: "and",
			conditions,
		};
	}

	// Single operator
	const operator = operators[0];
	if (!operator || !isValidFilterOperator(operator)) {
		if (operator) {
			errors.push({
				code: "INVALID_OPERATOR",
				field: path.join("."),
				message: `Invalid filter operator: "${operator}"`,
				path: [...path, operator],
			});
		}
		return null;
	}

	return {
		type: "field",
		field: fieldName,
		operator,
		value: obj[operator],
	};
}

/**
 * Input query parameters that can be parsed
 */
export interface QueryInput {
	/** Comma-separated field names to select */
	fields?: string | null;
	/** Page number (1-based) */
	page?: string | number | null;
	/** Number of items per page */
	limit?: string | number | null;
	/** Sort specification (e.g., "createdAt:desc,name:asc") */
	sort?: string | null;
	/** Filter object from QS parsing */
	filter?: unknown;
}

/**
 * Parse a query input object into a QueryAST.
 *
 * This is the main entry point for parsing query parameters into an AST.
 * It combines all parsing functions and returns a ParserResult with the
 * AST, any errors, and any warnings.
 *
 * @param input - Query input object with fields, page, limit, sort, and filter
 * @returns ParserResult containing the AST, errors, and warnings
 *
 * @example
 * const result = parse({
 *   fields: "id,name,email",
 *   page: "2",
 *   limit: "10",
 *   sort: "createdAt:desc",
 *   filter: { status: { eq: "active" } }
 * });
 *
 * if (result.errors.length === 0) {
 *   console.log(result.ast);
 * }
 */
export function parse(input: QueryInput): ParserResult {
	const errors: ParseError[] = [];
	const warnings: ParseWarning[] = [];

	// Parse fields
	const fields = parseFields(input.fields);

	// Parse pagination
	const pagination = parsePagination(input.page, input.limit);

	// Add warning if defaults were applied
	if (input.page === undefined && input.limit === undefined) {
		// No warning needed - defaults are expected
	} else if (input.page === undefined) {
		warnings.push({
			code: "DEFAULT_APPLIED",
			field: "page",
			message: "Page parameter not provided, defaulting to page 1",
			suggestion: "Provide a page parameter for explicit pagination",
		});
	}

	// Parse sort
	const sort = parseSort(input.sort);

	// Parse filter
	const filter = parseFilter(input.filter, errors);

	// If there are critical errors, return null AST
	const hasCriticalErrors = errors.some(
		(e) => e.code === "INVALID_VALUE" || e.code === "SECURITY_VIOLATION" || e.code === "EXCEEDED_LIMIT",
	);

	if (hasCriticalErrors) {
		return {
			ast: null,
			errors,
			warnings,
		};
	}

	const ast: QueryAST = {
		fields,
		pagination,
		sort,
		filter,
	};

	return {
		ast,
		errors,
		warnings,
	};
}

/**
 * Parse a raw query string using the qs library format.
 *
 * This function accepts a raw query string and parses it using qs,
 * then converts it to a QueryAST. Supports bracket notation for filters
 * like `filter[title][containsi]=value`.
 *
 * @param queryString - Raw query string (with or without leading ?)
 * @returns ParserResult containing the AST, errors, and warnings
 *
 * @example
 * const result = parseQueryString("fields=id,name&page=2&limit=10&sort=createdAt:desc&filter[status][eq]=active");
 * const result2 = parseQueryString("?fields=id,name&filter[title][containsi]=typescript");
 */
export function parseQueryString(queryString: string): ParserResult {
	// Remove leading ? if present
	const cleanQuery = queryString.startsWith("?") ? queryString.slice(1) : queryString;

	// Parse using qs library for full bracket notation support
	const parsed = qs.parse(cleanQuery);

	const input: QueryInput = {
		fields: typeof parsed.fields === "string" ? parsed.fields : undefined,
		page: typeof parsed.page === "string" ? parsed.page : undefined,
		limit: typeof parsed.limit === "string" ? parsed.limit : undefined,
		sort: typeof parsed.sort === "string" ? parsed.sort : undefined,
		filter: parsed.filter,
	};

	return parse(input);
}

/**
 * Parse a full URL and extract query parameters into a QueryAST.
 *
 * This is a convenience function that extracts the query string from a URL
 * and parses it using the qs library.
 *
 * @param url - Full URL string
 * @returns ParserResult containing the AST, errors, and warnings
 *
 * @example
 * const result = parseFromUrl("http://localhost:8787/api/posts?filter[title][containsi]=typescript&page=1&limit=10");
 */
export function parseFromUrl(url: string): ParserResult {
	const queryStart = url.indexOf("?");
	if (queryStart === -1) {
		return parse({});
	}

	const queryString = url.slice(queryStart + 1);
	return parseQueryString(queryString);
}
