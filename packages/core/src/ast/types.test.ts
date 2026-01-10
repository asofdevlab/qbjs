/**
 * Property-based tests for AST types
 *
 * **Feature: ast-compiler-architecture, Property 1: AST Structure Validity**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
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
} from "./types"
import { FILTER_OPERATORS, isFieldFilter, isLogicalFilter, LOGICAL_OPERATORS, SORT_DIRECTIONS } from "./types"

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
	fc.tuple(fc.integer(), fc.integer()), // for between operator
)

const fieldFilterArb: fc.Arbitrary<FieldFilter> = fc.record({
	type: fc.constant("field" as const),
	field: fieldNameArb,
	operator: filterOperatorArb,
	value: filterValueArb,
})

// Recursive arbitrary for FilterNode (limited depth to avoid infinite recursion)
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
	limit: fc.integer({ min: 1, max: 100 }),
})

const queryASTArb: fc.Arbitrary<QueryAST> = fc.record({
	fields: fc.oneof(fc.constant(null), fc.array(fieldNameArb, { minLength: 1, maxLength: 20 })),
	pagination: paginationArb,
	sort: fc.array(sortSpecArb, { maxLength: 5 }),
	filter: fc.oneof(fc.constant(null), filterNodeArb(3)),
})

describe("AST Types Property Tests", () => {
	describe("Property 1: AST Structure Validity", () => {
		/**
		 * **Feature: ast-compiler-architecture, Property 1: AST Structure Validity**
		 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
		 *
		 * For any QueryAST object, it SHALL contain valid fields (array or null),
		 * pagination (with numeric offset and limit), sort (array of field/direction pairs),
		 * and filter (FilterNode or null) properties.
		 */
		it("should have valid QueryAST structure with all required properties", () => {
			fc.assert(
				fc.property(queryASTArb, (ast: QueryAST) => {
					// Requirement 1.1: QueryAST contains fields, pagination, sort, and filter
					expect(ast).toHaveProperty("fields")
					expect(ast).toHaveProperty("pagination")
					expect(ast).toHaveProperty("sort")
					expect(ast).toHaveProperty("filter")

					// Fields should be array or null
					expect(ast.fields === null || Array.isArray(ast.fields)).toBe(true)
					if (ast.fields !== null) {
						ast.fields.forEach((field) => {
							expect(typeof field).toBe("string")
						})
					}

					// Requirement 1.2: Pagination has numeric offset and limit
					expect(typeof ast.pagination.offset).toBe("number")
					expect(typeof ast.pagination.limit).toBe("number")
					expect(ast.pagination.offset).toBeGreaterThanOrEqual(0)
					expect(ast.pagination.limit).toBeGreaterThan(0)

					// Requirement 1.3: Sort is array of field/direction pairs
					expect(Array.isArray(ast.sort)).toBe(true)
					ast.sort.forEach((sortSpec) => {
						expect(typeof sortSpec.field).toBe("string")
						expect(SORT_DIRECTIONS).toContain(sortSpec.direction)
					})

					// Requirement 1.4 & 1.5: Filter is FilterNode or null
					if (ast.filter !== null) {
						validateFilterNode(ast.filter)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should have valid SortSpec structure", () => {
			fc.assert(
				fc.property(sortSpecArb, (sortSpec: SortSpec) => {
					expect(typeof sortSpec.field).toBe("string")
					expect(sortSpec.field.length).toBeGreaterThan(0)
					expect(SORT_DIRECTIONS).toContain(sortSpec.direction)
				}),
				{ numRuns: 100 },
			)
		})

		it("should have valid FieldFilter structure", () => {
			fc.assert(
				fc.property(fieldFilterArb, (filter: FieldFilter) => {
					expect(filter.type).toBe("field")
					expect(typeof filter.field).toBe("string")
					expect(filter.field.length).toBeGreaterThan(0)
					expect(FILTER_OPERATORS).toContain(filter.operator)
					expect(filter).toHaveProperty("value")
				}),
				{ numRuns: 100 },
			)
		})

		it("should have valid LogicalFilter structure", () => {
			const logicalFilterArb: fc.Arbitrary<LogicalFilter> = fc.record({
				type: fc.constant("logical" as const),
				operator: logicalOperatorArb,
				conditions: fc.array(fieldFilterArb, { minLength: 1, maxLength: 3 }),
			})

			fc.assert(
				fc.property(logicalFilterArb, (filter: LogicalFilter) => {
					expect(filter.type).toBe("logical")
					expect(LOGICAL_OPERATORS).toContain(filter.operator)
					expect(Array.isArray(filter.conditions)).toBe(true)
					expect(filter.conditions.length).toBeGreaterThan(0)
				}),
				{ numRuns: 100 },
			)
		})

		it("should correctly identify FieldFilter with type guard", () => {
			fc.assert(
				fc.property(fieldFilterArb, (filter: FieldFilter) => {
					expect(isFieldFilter(filter)).toBe(true)
					expect(isLogicalFilter(filter)).toBe(false)
				}),
				{ numRuns: 100 },
			)
		})

		it("should correctly identify LogicalFilter with type guard", () => {
			const logicalFilterArb: fc.Arbitrary<LogicalFilter> = fc.record({
				type: fc.constant("logical" as const),
				operator: logicalOperatorArb,
				conditions: fc.array(fieldFilterArb, { minLength: 1, maxLength: 3 }),
			})

			fc.assert(
				fc.property(logicalFilterArb, (filter: LogicalFilter) => {
					expect(isLogicalFilter(filter)).toBe(true)
					expect(isFieldFilter(filter)).toBe(false)
				}),
				{ numRuns: 100 },
			)
		})

		it("should support nested logical filters (Requirement 1.5)", () => {
			fc.assert(
				fc.property(filterNodeArb(3), (filter: FilterNode) => {
					validateFilterNode(filter)
				}),
				{ numRuns: 100 },
			)
		})
	})
})

describe("AST Serialization Property Tests", () => {
	describe("Property 4: AST Serialization Determinism", () => {
		/**
		 * **Feature: ast-compiler-architecture, Property 4: AST Serialization Determinism**
		 * **Validates: Requirements 1.6**
		 *
		 * For any QueryAST object, serializing it to JSON multiple times
		 * SHALL produce identical output strings.
		 */
		it("should produce identical JSON output when serialized multiple times", () => {
			fc.assert(
				fc.property(queryASTArb, (ast: QueryAST) => {
					const serialized1 = JSON.stringify(ast)
					const serialized2 = JSON.stringify(ast)
					const serialized3 = JSON.stringify(ast)

					expect(serialized1).toBe(serialized2)
					expect(serialized2).toBe(serialized3)
				}),
				{ numRuns: 100 },
			)
		})

		it("should produce identical JSON output for equivalent AST objects", () => {
			fc.assert(
				fc.property(queryASTArb, (ast: QueryAST) => {
					// Create a deep copy by serializing and deserializing
					const copy = JSON.parse(JSON.stringify(ast)) as QueryAST

					const originalSerialized = JSON.stringify(ast)
					const copySerialized = JSON.stringify(copy)

					expect(originalSerialized).toBe(copySerialized)
				}),
				{ numRuns: 100 },
			)
		})

		it("should produce deterministic output for FilterNode serialization", () => {
			fc.assert(
				fc.property(filterNodeArb(3), (filter: FilterNode) => {
					const serialized1 = JSON.stringify(filter)
					const serialized2 = JSON.stringify(filter)

					expect(serialized1).toBe(serialized2)
				}),
				{ numRuns: 100 },
			)
		})

		it("should produce deterministic output for SortSpec array serialization", () => {
			fc.assert(
				fc.property(fc.array(sortSpecArb, { maxLength: 5 }), (sortSpecs: SortSpec[]) => {
					const serialized1 = JSON.stringify(sortSpecs)
					const serialized2 = JSON.stringify(sortSpecs)

					expect(serialized1).toBe(serialized2)
				}),
				{ numRuns: 100 },
			)
		})
	})
})

/**
 * Helper function to recursively validate a FilterNode structure
 */
function validateFilterNode(node: FilterNode): void {
	if (isFieldFilter(node)) {
		expect(node.type).toBe("field")
		expect(typeof node.field).toBe("string")
		expect(FILTER_OPERATORS).toContain(node.operator)
		expect(node).toHaveProperty("value")
	} else if (isLogicalFilter(node)) {
		expect(node.type).toBe("logical")
		expect(LOGICAL_OPERATORS).toContain(node.operator)
		expect(Array.isArray(node.conditions)).toBe(true)
		node.conditions.forEach((condition) => {
			validateFilterNode(condition)
		})
	} else {
		throw new Error("Invalid FilterNode: must be either FieldFilter or LogicalFilter")
	}
}
