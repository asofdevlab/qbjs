/**
 * Property-based tests for Security Validation
 *
 * **Feature: ast-compiler-architecture, Property 7: Security Config Enforcement**
 * **Validates: Requirements 7.5, 7.6, 7.7**
 */

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import type {
	FieldFilter,
	FilterNode,
	FilterOperator,
	LogicalFilter,
	LogicalOperator,
	QueryAST,
	SortDirection,
	SortSpec,
} from "../ast/types"
import { FILTER_OPERATORS, LOGICAL_OPERATORS, SORT_DIRECTIONS } from "../ast/types"
import type { SecurityConfig } from "./types"
import { DEFAULT_SECURITY_CONFIG } from "./types"
import {
	extractFilterFields,
	validateFields,
	validateFilterFields,
	validateLimit,
	validateOperators,
	validateSecurity,
	validateSortFields,
} from "./validator"

// Arbitraries for generating valid AST components

const fieldNameArb = fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]*$/).filter((s) => s.length > 0 && s.length <= 50)

const filterOperatorArb: fc.Arbitrary<FilterOperator> = fc.constantFrom(...FILTER_OPERATORS)

const logicalOperatorArb: fc.Arbitrary<LogicalOperator> = fc.constantFrom(...LOGICAL_OPERATORS)

const sortDirectionArb: fc.Arbitrary<SortDirection> = fc.constantFrom(...SORT_DIRECTIONS)

const sortSpecArb: fc.Arbitrary<SortSpec> = fc.record({
	field: fieldNameArb,
	direction: sortDirectionArb,
})

const filterValueArb = fc.oneof(
	fc.string(),
	fc.integer(),
	fc.double({ noNaN: true }),
	fc.boolean(),
	fc.constant(null),
	fc.array(fc.oneof(fc.string(), fc.integer()), { maxLength: 10 }),
)

const fieldFilterArb: fc.Arbitrary<FieldFilter> = fc.record({
	type: fc.constant("field" as const),
	field: fieldNameArb,
	operator: filterOperatorArb,
	value: filterValueArb,
})

// Recursive arbitrary for FilterNode (limited depth)
const filterNodeArb = (maxDepth: number): fc.Arbitrary<FilterNode> => {
	if (maxDepth <= 0) {
		return fieldFilterArb
	}

	const logicalFilterArb: fc.Arbitrary<LogicalFilter> = fc.record({
		type: fc.constant("logical" as const),
		operator: logicalOperatorArb,
		conditions: fc.array(filterNodeArb(maxDepth - 1), { minLength: 1, maxLength: 3 }),
	})

	return fc.oneof(fieldFilterArb, logicalFilterArb)
}

const paginationArb = fc.record({
	offset: fc.nat({ max: 10000 }),
	limit: fc.integer({ min: 1, max: 1000 }),
})

const queryASTArb: fc.Arbitrary<QueryAST> = fc.record({
	fields: fc.oneof(fc.constant(null), fc.array(fieldNameArb, { minLength: 1, maxLength: 20 })),
	pagination: paginationArb,
	sort: fc.array(sortSpecArb, { maxLength: 5 }),
	filter: fc.oneof(fc.constant(null), filterNodeArb(3)),
})

describe("Security Validation Property Tests", () => {
	describe("Property 7: Security Config Enforcement", () => {
		/**
		 * **Feature: ast-compiler-architecture, Property 7: Security Config Enforcement**
		 * **Validates: Requirements 7.5, 7.6, 7.7**
		 *
		 * For any QueryBuilder configured with security constraints:
		 * - Queries requesting fields not in allowedFields SHALL be rejected
		 * - Queries with limit exceeding maxLimit SHALL have limit capped to maxLimit
		 * - Queries using operators not in allowed operators SHALL be rejected
		 */

		it("should reject queries with fields not in allowedFields (Requirement 7.5)", () => {
			// Generate a set of allowed fields and a query that may contain disallowed fields
			const testArb = fc.record({
				allowedFields: fc.array(fieldNameArb, { minLength: 1, maxLength: 5 }),
				requestedFields: fc.array(fieldNameArb, { minLength: 1, maxLength: 10 }),
			})

			fc.assert(
				fc.property(testArb, ({ allowedFields, requestedFields }) => {
					const errors = validateFields(requestedFields, allowedFields)

					// Check that every disallowed field produces an error
					for (const field of requestedFields) {
						if (!allowedFields.includes(field)) {
							const hasError = errors.some((e) => e.field === field && e.code === "FIELD_NOT_ALLOWED")
							expect(hasError).toBe(true)
						}
					}

					// Check that allowed fields don't produce errors
					for (const field of requestedFields) {
						if (allowedFields.includes(field)) {
							const hasError = errors.some((e) => e.field === field)
							expect(hasError).toBe(false)
						}
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should allow all fields when allowedFields is empty", () => {
			fc.assert(
				fc.property(fc.array(fieldNameArb, { minLength: 1, maxLength: 10 }), (requestedFields) => {
					const errors = validateFields(requestedFields, [])
					expect(errors).toHaveLength(0)
				}),
				{ numRuns: 100 },
			)
		})

		it("should cap limit to maxLimit when exceeded (Requirement 7.6)", () => {
			const testArb = fc.record({
				requestedLimit: fc.integer({ min: 1, max: 10000 }),
				maxLimit: fc.integer({ min: 1, max: 500 }),
			})

			fc.assert(
				fc.property(testArb, ({ requestedLimit, maxLimit }) => {
					const { limit, warning } = validateLimit(requestedLimit, maxLimit)

					if (requestedLimit > maxLimit) {
						// Limit should be capped
						expect(limit).toBe(maxLimit)
						// Warning should be present
						expect(warning).not.toBeNull()
						expect(warning?.code).toBe("LIMIT_CAPPED")
						expect(warning?.originalValue).toBe(requestedLimit)
						expect(warning?.cappedValue).toBe(maxLimit)
					} else {
						// Limit should remain unchanged
						expect(limit).toBe(requestedLimit)
						// No warning
						expect(warning).toBeNull()
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should reject queries with operators not in allowed operators (Requirement 7.7)", () => {
			// Generate a subset of allowed operators and a filter that may use disallowed operators
			const testArb = fc.record({
				allowedOperators: fc.shuffledSubarray([...FILTER_OPERATORS], { minLength: 1 }),
				filter: fieldFilterArb,
			})

			fc.assert(
				fc.property(testArb, ({ allowedOperators, filter }) => {
					const errors = validateOperators(filter, allowedOperators as FilterOperator[])

					if (!allowedOperators.includes(filter.operator)) {
						// Should have an error for disallowed operator
						expect(errors.length).toBeGreaterThan(0)
						expect(errors.some((e) => e.code === "OPERATOR_NOT_ALLOWED")).toBe(true)
					} else {
						// Should have no errors for allowed operator
						expect(errors).toHaveLength(0)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should validate operators in nested logical filters", () => {
			const testArb = fc.record({
				allowedOperators: fc.shuffledSubarray([...FILTER_OPERATORS], { minLength: 1 }),
				filter: filterNodeArb(2),
			})

			fc.assert(
				fc.property(testArb, ({ allowedOperators, filter }) => {
					const errors = validateOperators(filter, allowedOperators as FilterOperator[])

					// Extract all operators from the filter
					const usedOperators = extractOperatorsFromFilter(filter)

					// Count disallowed operators
					const disallowedCount = usedOperators.filter((op) => !allowedOperators.includes(op)).length

					// Should have at least one error per disallowed operator
					if (disallowedCount > 0) {
						expect(errors.length).toBeGreaterThanOrEqual(disallowedCount)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should validate filter fields against allowedFields", () => {
			const testArb = fc.record({
				allowedFields: fc.array(fieldNameArb, { minLength: 1, maxLength: 5 }),
				filter: filterNodeArb(2),
			})

			fc.assert(
				fc.property(testArb, ({ allowedFields, filter }) => {
					const errors = validateFilterFields(filter, allowedFields)
					const filterFields = extractFilterFields(filter)

					// Check that every disallowed field produces an error
					for (const field of filterFields) {
						if (!allowedFields.includes(field)) {
							const hasError = errors.some((e) => e.field === field && e.code === "FIELD_NOT_ALLOWED")
							expect(hasError).toBe(true)
						}
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should validate sort fields against allowedFields", () => {
			const testArb = fc.record({
				allowedFields: fc.array(fieldNameArb, { minLength: 1, maxLength: 5 }),
				sort: fc.array(sortSpecArb, { minLength: 1, maxLength: 5 }),
			})

			fc.assert(
				fc.property(testArb, ({ allowedFields, sort }) => {
					const errors = validateSortFields(sort, allowedFields)

					// Check that every disallowed field produces an error
					for (const spec of sort) {
						if (!allowedFields.includes(spec.field)) {
							const hasError = errors.some((e) => e.field === spec.field && e.code === "FIELD_NOT_ALLOWED")
							expect(hasError).toBe(true)
						}
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should validate complete AST against security config", () => {
			const testArb = fc.record({
				ast: queryASTArb,
				config: fc.record({
					allowedFields: fc.oneof(fc.constant([]), fc.array(fieldNameArb, { minLength: 1, maxLength: 5 })),
					maxLimit: fc.integer({ min: 10, max: 200 }),
					operators: fc.shuffledSubarray([...FILTER_OPERATORS], { minLength: 3 }),
				}),
			})

			fc.assert(
				fc.property(testArb, ({ ast, config }) => {
					const securityConfig: SecurityConfig = {
						allowedFields: [...config.allowedFields],
						maxLimit: config.maxLimit,
						operators: config.operators as FilterOperator[],
					}

					const result = validateSecurity(ast, securityConfig)

					// Result should always have the expected structure
					expect(result).toHaveProperty("valid")
					expect(result).toHaveProperty("errors")
					expect(result).toHaveProperty("warnings")
					expect(result).toHaveProperty("ast")

					// If there are errors, valid should be false
					if (result.errors.length > 0) {
						expect(result.valid).toBe(false)
					} else {
						expect(result.valid).toBe(true)
					}

					// The returned AST should have limit capped if needed
					if (result.ast && ast.pagination.limit > config.maxLimit) {
						expect(result.ast.pagination.limit).toBe(config.maxLimit)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should use default security config when none provided", () => {
			fc.assert(
				fc.property(queryASTArb, (ast) => {
					const result = validateSecurity(ast)

					// With default config (all fields allowed, all operators allowed)
					// only limit capping should occur
					const fieldErrors = result.errors.filter((e) => e.code === "FIELD_NOT_ALLOWED")
					const operatorErrors = result.errors.filter((e) => e.code === "OPERATOR_NOT_ALLOWED")

					// Default config allows all fields and operators
					expect(fieldErrors).toHaveLength(0)
					expect(operatorErrors).toHaveLength(0)

					// Limit should be capped to default maxLimit (100)
					if (result.ast) {
						expect(result.ast.pagination.limit).toBeLessThanOrEqual(DEFAULT_SECURITY_CONFIG.maxLimit)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should handle null AST gracefully", () => {
			const result = validateSecurity(null)
			expect(result.valid).toBe(true)
			expect(result.errors).toHaveLength(0)
			expect(result.warnings).toHaveLength(0)
			expect(result.ast).toBeNull()
		})

		it("should handle null filter gracefully", () => {
			const astWithNullFilter: QueryAST = {
				fields: ["id", "name"],
				pagination: { offset: 0, limit: 10 },
				sort: [],
				filter: null,
			}

			const result = validateSecurity(astWithNullFilter, {
				allowedFields: ["id", "name"],
				operators: ["eq"],
			})

			expect(result.valid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})
	})
})

/**
 * Helper function to extract all operators from a filter node
 */
function extractOperatorsFromFilter(filter: FilterNode): FilterOperator[] {
	const operators: FilterOperator[] = []

	function traverse(node: FilterNode): void {
		if (node.type === "field") {
			operators.push(node.operator)
		} else if (node.type === "logical") {
			for (const condition of node.conditions) {
				traverse(condition)
			}
		}
	}

	traverse(filter)
	return operators
}
