/**
 * Security Validation for @qbjs/core
 *
 * This module provides validation functions to enforce security constraints
 * on parsed queries based on the security configuration.
 *
 * @module security/validator
 */

import type { FilterNode, FilterOperator, QueryAST } from "../ast/types";
import { isFieldFilter, isLogicalFilter } from "../ast/types";
import type { SecurityConfig } from "./types";
import { resolveSecurityConfig } from "./types";

/**
 * Security validation error
 */
export interface SecurityError {
	code: "FIELD_NOT_ALLOWED" | "OPERATOR_NOT_ALLOWED" | "LIMIT_EXCEEDED";
	field: string;
	message: string;
	path: string[];
}

/**
 * Security validation warning
 */
export interface SecurityWarning {
	code: "LIMIT_CAPPED";
	field: string;
	message: string;
	originalValue: number;
	cappedValue: number;
}

/**
 * Result of security validation
 */
export interface SecurityValidationResult {
	/** Whether the validation passed (no errors) */
	valid: boolean;
	/** Validation errors that prevent query execution */
	errors: SecurityError[];
	/** Validation warnings (non-fatal issues) */
	warnings: SecurityWarning[];
	/** The potentially modified AST (e.g., with capped limit) */
	ast: QueryAST | null;
}

/**
 * Validate that requested fields are allowed by the security config.
 *
 * @param fields - Array of field names to validate
 * @param allowedFields - Array of allowed field names (empty means all allowed)
 * @returns Array of security errors for disallowed fields
 */
export function validateFields(fields: string[] | null, allowedFields: string[]): SecurityError[] {
	const errors: SecurityError[] = [];

	// If no fields specified or allowedFields is empty (all allowed), no validation needed
	if (!fields || fields.length === 0 || allowedFields.length === 0) {
		return errors;
	}

	for (const field of fields) {
		if (!allowedFields.includes(field)) {
			errors.push({
				code: "FIELD_NOT_ALLOWED",
				field,
				message: `Field "${field}" is not allowed. Allowed fields: ${allowedFields.join(", ")}`,
				path: ["fields", field],
			});
		}
	}

	return errors;
}

/**
 * Validate and cap the limit against maxLimit.
 *
 * @param limit - The requested limit
 * @param maxLimit - The maximum allowed limit
 * @returns Object with the validated limit and optional warning
 */
export function validateLimit(limit: number, maxLimit: number): { limit: number; warning: SecurityWarning | null } {
	if (limit <= maxLimit) {
		return { limit, warning: null };
	}

	return {
		limit: maxLimit,
		warning: {
			code: "LIMIT_CAPPED",
			field: "limit",
			message: `Limit ${limit} exceeds maximum allowed limit of ${maxLimit}. Capped to ${maxLimit}.`,
			originalValue: limit,
			cappedValue: maxLimit,
		},
	};
}

/**
 * Validate that filter operators are allowed by the security config.
 *
 * @param filter - The filter node to validate
 * @param allowedOperators - Array of allowed operators
 * @param path - Current path for error reporting
 * @returns Array of security errors for disallowed operators
 */
export function validateOperators(
	filter: FilterNode | null,
	allowedOperators: FilterOperator[],
	path: string[] = ["filter"],
): SecurityError[] {
	const errors: SecurityError[] = [];

	if (!filter) {
		return errors;
	}

	if (isFieldFilter(filter)) {
		if (!allowedOperators.includes(filter.operator)) {
			errors.push({
				code: "OPERATOR_NOT_ALLOWED",
				field: filter.field,
				message: `Operator "${filter.operator}" is not allowed. Allowed operators: ${allowedOperators.join(", ")}`,
				path: [...path, filter.field, filter.operator],
			});
		}
	} else if (isLogicalFilter(filter)) {
		// Recursively validate conditions in logical filters
		for (let i = 0; i < filter.conditions.length; i++) {
			const condition = filter.conditions[i];
			if (condition) {
				const conditionErrors = validateOperators(condition, allowedOperators, [...path, filter.operator, String(i)]);
				errors.push(...conditionErrors);
			}
		}
	}

	return errors;
}

/**
 * Extract all field names referenced in a filter.
 *
 * @param filter - The filter node to extract fields from
 * @returns Array of unique field names
 */
export function extractFilterFields(filter: FilterNode | null): string[] {
	const fields = new Set<string>();

	function traverse(node: FilterNode | null): void {
		if (!node) return;

		if (isFieldFilter(node)) {
			fields.add(node.field);
		} else if (isLogicalFilter(node)) {
			for (const condition of node.conditions) {
				traverse(condition);
			}
		}
	}

	traverse(filter);
	return Array.from(fields);
}

/**
 * Validate filter fields against allowed fields.
 *
 * @param filter - The filter node to validate
 * @param allowedFields - Array of allowed field names (empty means all allowed)
 * @param path - Current path for error reporting
 * @returns Array of security errors for disallowed fields
 */
export function validateFilterFields(
	filter: FilterNode | null,
	allowedFields: string[],
	path: string[] = ["filter"],
): SecurityError[] {
	const errors: SecurityError[] = [];

	// If allowedFields is empty, all fields are allowed
	if (allowedFields.length === 0 || !filter) {
		return errors;
	}

	const filterFields = extractFilterFields(filter);

	for (const field of filterFields) {
		if (!allowedFields.includes(field)) {
			errors.push({
				code: "FIELD_NOT_ALLOWED",
				field,
				message: `Filter field "${field}" is not allowed. Allowed fields: ${allowedFields.join(", ")}`,
				path: [...path, field],
			});
		}
	}

	return errors;
}

/**
 * Validate sort fields against allowed fields.
 *
 * @param sort - Array of sort specifications
 * @param allowedFields - Array of allowed field names (empty means all allowed)
 * @returns Array of security errors for disallowed fields
 */
export function validateSortFields(sort: QueryAST["sort"], allowedFields: string[]): SecurityError[] {
	const errors: SecurityError[] = [];

	// If allowedFields is empty, all fields are allowed
	if (allowedFields.length === 0 || sort.length === 0) {
		return errors;
	}

	for (const spec of sort) {
		if (!allowedFields.includes(spec.field)) {
			errors.push({
				code: "FIELD_NOT_ALLOWED",
				field: spec.field,
				message: `Sort field "${spec.field}" is not allowed. Allowed fields: ${allowedFields.join(", ")}`,
				path: ["sort", spec.field],
			});
		}
	}

	return errors;
}

/**
 * Validate a QueryAST against security configuration.
 *
 * This is the main entry point for security validation. It validates:
 * - Selected fields against allowedFields
 * - Filter fields against allowedFields
 * - Sort fields against allowedFields
 * - Filter operators against allowed operators
 * - Pagination limit against maxLimit (caps if exceeded)
 *
 * @param ast - The QueryAST to validate
 * @param config - Security configuration (uses defaults if not provided)
 * @returns SecurityValidationResult with errors, warnings, and potentially modified AST
 */
export function validateSecurity(ast: QueryAST | null, config?: SecurityConfig): SecurityValidationResult {
	if (!ast) {
		return {
			valid: true,
			errors: [],
			warnings: [],
			ast: null,
		};
	}

	const resolvedConfig = resolveSecurityConfig(config);
	const errors: SecurityError[] = [];
	const warnings: SecurityWarning[] = [];

	// Validate selected fields
	const fieldErrors = validateFields(ast.fields, resolvedConfig.allowedFields);
	errors.push(...fieldErrors);

	// Validate filter fields
	const filterFieldErrors = validateFilterFields(ast.filter, resolvedConfig.allowedFields);
	errors.push(...filterFieldErrors);

	// Validate sort fields
	const sortFieldErrors = validateSortFields(ast.sort, resolvedConfig.allowedFields);
	errors.push(...sortFieldErrors);

	// Validate filter operators
	const operatorErrors = validateOperators(ast.filter, resolvedConfig.operators);
	errors.push(...operatorErrors);

	// Validate and cap limit
	const { limit: cappedLimit, warning: limitWarning } = validateLimit(ast.pagination.limit, resolvedConfig.maxLimit);
	if (limitWarning) {
		warnings.push(limitWarning);
	}

	// Create modified AST with capped limit if needed
	const modifiedAst: QueryAST = {
		...ast,
		pagination: {
			...ast.pagination,
			limit: cappedLimit,
		},
	};

	return {
		valid: errors.length === 0,
		errors,
		warnings,
		ast: modifiedAst,
	};
}
