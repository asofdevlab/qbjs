/**
 * AST Type Definitions for @qbjs/core
 *
 * This module defines the Abstract Syntax Tree (AST) types that serve as the
 * stable contract between the parser and compilers. The AST is ORM-agnostic
 * and database-agnostic, providing a clean intermediate representation.
 *
 * @module ast/types
 */

/**
 * Filter operators supported by the query system.
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
	| "between";

/**
 * Sort direction for ordering query results.
 */
export type SortDirection = "asc" | "desc";

/**
 * Specification for sorting a single field.
 */
export interface SortSpec {
	/** The field name to sort by */
	field: string;
	/** The sort direction (ascending or descending) */
	direction: SortDirection;
}

/**
 * A filter condition on a specific field.
 */
export interface FieldFilter {
	/** Discriminator for filter node type */
	type: "field";
	/** The field name to filter on */
	field: string;
	/** The comparison operator */
	operator: FilterOperator;
	/** The value to compare against */
	value: unknown;
}

/**
 * Logical operators for combining filter conditions.
 */
export type LogicalOperator = "and" | "or" | "not";

/**
 * A logical combination of filter conditions.
 */
export interface LogicalFilter {
	/** Discriminator for filter node type */
	type: "logical";
	/** The logical operator (and, or, not) */
	operator: LogicalOperator;
	/** The conditions to combine */
	conditions: FilterNode[];
}

/**
 * A filter node can be either a field filter or a logical filter.
 * This allows for arbitrarily complex filter expressions.
 */
export type FilterNode = FieldFilter | LogicalFilter;

/**
 * Pagination specification with offset-based pagination.
 */
export interface Pagination {
	/** Number of items to skip */
	offset: number;
	/** Maximum number of items to return */
	limit: number;
}

/**
 * The main AST structure representing a parsed query.
 * This is the stable contract between parser and compilers.
 */
export interface QueryAST {
	/** Fields to select (null means all fields) */
	fields: string[] | null;
	/** Pagination specification */
	pagination: Pagination;
	/** Sort specifications (empty array means no sorting) */
	sort: SortSpec[];
	/** Filter expression (null means no filtering) */
	filter: FilterNode | null;
}

/**
 * Type guard to check if a FilterNode is a FieldFilter.
 */
export function isFieldFilter(node: FilterNode): node is FieldFilter {
	return node.type === "field";
}

/**
 * Type guard to check if a FilterNode is a LogicalFilter.
 */
export function isLogicalFilter(node: FilterNode): node is LogicalFilter {
	return node.type === "logical";
}

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
] as const;

/**
 * All supported logical operators as an array for validation.
 */
export const LOGICAL_OPERATORS: readonly LogicalOperator[] = ["and", "or", "not"] as const;

/**
 * All supported sort directions as an array for validation.
 */
export const SORT_DIRECTIONS: readonly SortDirection[] = ["asc", "desc"] as const;
