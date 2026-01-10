/**
 * AST Factory Functions for @qbjs/core
 *
 * This module provides factory functions for creating valid AST nodes
 * with proper validation of required properties.
 *
 * @module ast/factory
 */

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
 * Options for creating a QueryAST
 */
export interface CreateQueryASTOptions {
	/** Fields to select (null or undefined means all fields) */
	fields?: string[] | null;
	/** Pagination options */
	pagination?: Partial<Pagination>;
	/** Sort specifications */
	sort?: SortSpec[];
	/** Filter expression */
	filter?: FilterNode | null;
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGINATION: Pagination = {
	offset: 0,
	limit: 10,
};

/**
 * Creates a valid QueryAST with validation.
 *
 * @param options - Options for creating the QueryAST
 * @returns A valid QueryAST object
 * @throws Error if validation fails
 */
export function createQueryAST(options: CreateQueryASTOptions = {}): QueryAST {
	const { fields = null, pagination = {}, sort = [], filter = null } = options;

	// Validate fields
	if (fields !== null) {
		if (!Array.isArray(fields)) {
			throw new Error("fields must be an array or null");
		}
		for (const field of fields) {
			if (typeof field !== "string" || field.length === 0) {
				throw new Error("Each field must be a non-empty string");
			}
		}
	}

	// Validate and merge pagination
	const resolvedPagination: Pagination = {
		offset: pagination.offset ?? DEFAULT_PAGINATION.offset,
		limit: pagination.limit ?? DEFAULT_PAGINATION.limit,
	};

	if (typeof resolvedPagination.offset !== "number" || resolvedPagination.offset < 0) {
		throw new Error("pagination.offset must be a non-negative number");
	}
	if (typeof resolvedPagination.limit !== "number" || resolvedPagination.limit <= 0) {
		throw new Error("pagination.limit must be a positive number");
	}

	// Validate sort
	if (!Array.isArray(sort)) {
		throw new Error("sort must be an array");
	}
	for (const sortSpec of sort) {
		validateSortSpec(sortSpec);
	}

	// Validate filter
	if (filter !== null) {
		validateFilterNode(filter);
	}

	return {
		fields,
		pagination: resolvedPagination,
		sort,
		filter,
	};
}

/**
 * Creates a valid SortSpec with validation.
 *
 * @param field - The field name to sort by
 * @param direction - The sort direction (defaults to 'asc')
 * @returns A valid SortSpec object
 * @throws Error if validation fails
 */
export function createSortSpec(field: string, direction: SortDirection = "asc"): SortSpec {
	if (typeof field !== "string" || field.length === 0) {
		throw new Error("field must be a non-empty string");
	}
	if (!SORT_DIRECTIONS.includes(direction)) {
		throw new Error(`direction must be one of: ${SORT_DIRECTIONS.join(", ")}`);
	}

	return { field, direction };
}

/**
 * Creates a valid FieldFilter with validation.
 *
 * @param field - The field name to filter on
 * @param operator - The filter operator
 * @param value - The value to compare against
 * @returns A valid FieldFilter object
 * @throws Error if validation fails
 */
export function createFieldFilter(field: string, operator: FilterOperator, value: unknown): FieldFilter {
	if (typeof field !== "string" || field.length === 0) {
		throw new Error("field must be a non-empty string");
	}
	if (!FILTER_OPERATORS.includes(operator)) {
		throw new Error(`operator must be one of: ${FILTER_OPERATORS.join(", ")}`);
	}

	return {
		type: "field",
		field,
		operator,
		value,
	};
}

/**
 * Creates a valid LogicalFilter with validation.
 *
 * @param operator - The logical operator (and, or, not)
 * @param conditions - The filter conditions to combine
 * @returns A valid LogicalFilter object
 * @throws Error if validation fails
 */
export function createLogicalFilter(operator: LogicalOperator, conditions: FilterNode[]): LogicalFilter {
	if (!LOGICAL_OPERATORS.includes(operator)) {
		throw new Error(`operator must be one of: ${LOGICAL_OPERATORS.join(", ")}`);
	}
	if (!Array.isArray(conditions)) {
		throw new Error("conditions must be an array");
	}
	if (conditions.length === 0) {
		throw new Error("conditions must have at least one element");
	}

	// Validate each condition
	for (const condition of conditions) {
		validateFilterNode(condition);
	}

	return {
		type: "logical",
		operator,
		conditions,
	};
}

/**
 * Validates a SortSpec object.
 *
 * @param sortSpec - The SortSpec to validate
 * @throws Error if validation fails
 */
function validateSortSpec(sortSpec: SortSpec): void {
	if (typeof sortSpec !== "object" || sortSpec === null) {
		throw new Error("SortSpec must be an object");
	}
	if (typeof sortSpec.field !== "string" || sortSpec.field.length === 0) {
		throw new Error("SortSpec.field must be a non-empty string");
	}
	if (!SORT_DIRECTIONS.includes(sortSpec.direction)) {
		throw new Error(`SortSpec.direction must be one of: ${SORT_DIRECTIONS.join(", ")}`);
	}
}

/**
 * Validates a FilterNode object recursively.
 *
 * @param node - The FilterNode to validate
 * @throws Error if validation fails
 */
function validateFilterNode(node: FilterNode): void {
	if (typeof node !== "object" || node === null) {
		throw new Error("FilterNode must be an object");
	}

	if (node.type === "field") {
		if (typeof node.field !== "string" || node.field.length === 0) {
			throw new Error("FieldFilter.field must be a non-empty string");
		}
		if (!FILTER_OPERATORS.includes(node.operator)) {
			throw new Error(`FieldFilter.operator must be one of: ${FILTER_OPERATORS.join(", ")}`);
		}
		if (!("value" in node)) {
			throw new Error("FieldFilter must have a value property");
		}
	} else if (node.type === "logical") {
		if (!LOGICAL_OPERATORS.includes(node.operator)) {
			throw new Error(`LogicalFilter.operator must be one of: ${LOGICAL_OPERATORS.join(", ")}`);
		}
		if (!Array.isArray(node.conditions)) {
			throw new Error("LogicalFilter.conditions must be an array");
		}
		if (node.conditions.length === 0) {
			throw new Error("LogicalFilter.conditions must have at least one element");
		}
		for (const condition of node.conditions) {
			validateFilterNode(condition);
		}
	} else {
		throw new Error("FilterNode.type must be 'field' or 'logical'");
	}
}
