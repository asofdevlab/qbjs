/**
 * Property-based tests for AST Pretty Printer
 *
 * @module ast/printer.test
 */

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import { parse, parseFilter, parseSort } from "./parser"
import { print, printFields, printFilter, printPagination, printSort } from "./printer"
import type { FieldFilter, FilterNode, FilterOperator, LogicalFilter, QueryAST, SortDirection, SortSpec } from "./types"
import { FILTER_OPERATORS, isFieldFilter, isLogicalFilter, SORT_DIRECTIONS } from "./types"

// Arbitraries for generating valid AST components

const fieldNameArb = fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]*$/).filter((s) => s.length > 0 && s.length <= 50)

const filterOperatorArb: fc.Arbitrary<FilterOperator> = fc.constantFrom(...FILTER_OPERATORS)

const sortDirectionArb: fc.Arbitrary<SortDirection> = fc.constantFrom(...SORT_DIRECTIONS)

// Filter values that can be safely serialized and compared
const filterValueArb = fc.oneof(
	fc.string().filter((s) => s.length < 50 && !s.includes(",") && !s.includes(":")),
	fc.integer({ min: -1000000, max: 1000000 }),
	fc.boolean(),
	fc.constant(null),
)

// Generate a valid SortSpec
const sortSpecArb: fc.Arbitrary<SortSpec> = fc.record({
	field: fieldNameArb,
	direction: sortDirectionArb,
})

// Generate a valid FieldFilter
const fieldFilterArb: fc.Arbitrary<FieldFilter> = fc.record({
	type: fc.constant("field" as const),
	field: fieldNameArb,
	operator: filterOperatorArb,
	value: filterValueArb,
})

// Generate a valid LogicalFilter (non-recursive for simplicity)
const logicalFilterArb: fc.Arbitrary<LogicalFilter> = fc.record({
	type: fc.constant("logical" as const),
	operator: fc.constantFrom("and" as const, "or" as const, "not" as const),
	conditions: fc.array(fieldFilterArb, { minLength: 1, maxLength: 3 }),
})

// Generate a valid FilterNode (either field or logical)
const filterNodeArb: fc.Arbitrary<FilterNode> = fc.oneof(fieldFilterArb, logicalFilterArb)

// Generate a valid Pagination
const paginationArb = fc.record({
	offset: fc.integer({ min: 0, max: 10000 }),
	limit: fc.integer({ min: 1, max: 100 }),
})

// Generate a valid QueryAST
const queryASTArb: fc.Arbitrary<QueryAST> = fc.record({
	fields: fc.option(fc.array(fieldNameArb, { minLength: 1, maxLength: 10 }), { nil: null }),
	pagination: paginationArb,
	sort: fc.array(sortSpecArb, { maxLength: 5 }),
	filter: fc.option(filterNodeArb, { nil: null }),
})

describe("AST Pretty Printer Unit Tests", () => {
	describe("printFields", () => {
		it("should return undefined for null input", () => {
			expect(printFields(null)).toBeUndefined()
		})

		it("should return undefined for empty array", () => {
			expect(printFields([])).toBeUndefined()
		})

		it("should convert single field to string", () => {
			expect(printFields(["id"])).toBe("id")
		})

		it("should convert multiple fields to comma-separated string", () => {
			expect(printFields(["id", "name", "email"])).toBe("id,name,email")
		})
	})

	describe("printPagination", () => {
		it("should convert offset 0 to page 1", () => {
			expect(printPagination({ offset: 0, limit: 10 })).toEqual({ page: 1, limit: 10 })
		})

		it("should convert offset to correct page", () => {
			expect(printPagination({ offset: 10, limit: 10 })).toEqual({ page: 2, limit: 10 })
			expect(printPagination({ offset: 20, limit: 10 })).toEqual({ page: 3, limit: 10 })
			expect(printPagination({ offset: 40, limit: 20 })).toEqual({ page: 3, limit: 20 })
		})
	})

	describe("printSort", () => {
		it("should return undefined for empty array", () => {
			expect(printSort([])).toBeUndefined()
		})

		it("should convert single sort spec", () => {
			expect(printSort([{ field: "createdAt", direction: "desc" }])).toBe("createdAt:desc")
		})

		it("should convert multiple sort specs", () => {
			expect(
				printSort([
					{ field: "createdAt", direction: "desc" },
					{ field: "name", direction: "asc" },
				]),
			).toBe("createdAt:desc,name:asc")
		})
	})

	describe("printFilter", () => {
		it("should return undefined for null input", () => {
			expect(printFilter(null)).toBeUndefined()
		})

		it("should convert field filter", () => {
			const filter: FieldFilter = {
				type: "field",
				field: "title",
				operator: "eq",
				value: "hello",
			}
			expect(printFilter(filter)).toEqual({ title: { eq: "hello" } })
		})

		it("should convert logical AND filter", () => {
			const filter: LogicalFilter = {
				type: "logical",
				operator: "and",
				conditions: [
					{ type: "field", field: "title", operator: "eq", value: "hello" },
					{ type: "field", field: "status", operator: "eq", value: "active" },
				],
			}
			expect(printFilter(filter)).toEqual({
				and: [{ title: { eq: "hello" } }, { status: { eq: "active" } }],
			})
		})

		it("should convert logical OR filter", () => {
			const filter: LogicalFilter = {
				type: "logical",
				operator: "or",
				conditions: [
					{ type: "field", field: "status", operator: "eq", value: "active" },
					{ type: "field", field: "status", operator: "eq", value: "pending" },
				],
			}
			expect(printFilter(filter)).toEqual({
				or: [{ status: { eq: "active" } }, { status: { eq: "pending" } }],
			})
		})
	})

	describe("print (main function)", () => {
		it("should convert complete AST to query params", () => {
			const ast: QueryAST = {
				fields: ["id", "name", "email"],
				pagination: { offset: 10, limit: 10 },
				sort: [{ field: "createdAt", direction: "desc" }],
				filter: { type: "field", field: "status", operator: "eq", value: "active" },
			}

			const result = print(ast)

			expect(result.fields).toBe("id,name,email")
			expect(result.page).toBe(2)
			expect(result.limit).toBe(10)
			expect(result.sort).toBe("createdAt:desc")
			expect(result.filter).toEqual({ status: { eq: "active" } })
		})

		it("should handle AST with null fields and filter", () => {
			const ast: QueryAST = {
				fields: null,
				pagination: { offset: 0, limit: 10 },
				sort: [],
				filter: null,
			}

			const result = print(ast)

			expect(result.fields).toBeUndefined()
			expect(result.page).toBe(1)
			expect(result.limit).toBe(10)
			expect(result.sort).toBeUndefined()
			expect(result.filter).toBeUndefined()
		})
	})
})

describe("AST Pretty Printer Property Tests", () => {
	describe("Property 3: Round-Trip Parsing", () => {
		/**
		 * **Feature: ast-compiler-architecture, Property 3: Round-Trip Parsing**
		 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
		 *
		 * For any valid QueryAST object, printing it to a QS string and then
		 * parsing that string back SHALL produce an equivalent QueryAST
		 * (where equivalence means all fields, pagination, sort, and filter values are equal).
		 */

		it("should round-trip fields correctly", () => {
			fc.assert(
				fc.property(fc.array(fieldNameArb, { minLength: 1, maxLength: 10 }), (fields) => {
					// Print fields to string
					const printed = printFields(fields)
					expect(printed).toBeDefined()

					// Parse back
					const result = parse({ fields: printed })
					expect(result.ast).not.toBeNull()

					// Should be equivalent
					expect(result.ast?.fields).toEqual(fields)
				}),
				{ numRuns: 100 },
			)
		})

		it("should round-trip pagination correctly", () => {
			fc.assert(
				fc.property(paginationArb, (pagination) => {
					// Print pagination to page/limit
					const { page, limit } = printPagination(pagination)

					// Parse back
					const result = parse({ page: String(page), limit: String(limit) })
					expect(result.ast).not.toBeNull()

					// Offset should be equivalent (may differ by rounding if offset not divisible by limit)
					const expectedOffset = (page - 1) * limit
					expect(result.ast?.pagination.offset).toBe(expectedOffset)
					expect(result.ast?.pagination.limit).toBe(limit)
				}),
				{ numRuns: 100 },
			)
		})

		it("should round-trip sort correctly", () => {
			fc.assert(
				fc.property(fc.array(sortSpecArb, { minLength: 1, maxLength: 5 }), (sort) => {
					// Print sort to string
					const printed = printSort(sort)
					expect(printed).toBeDefined()

					// Parse back
					const parsed = parseSort(printed)

					// Should be equivalent
					expect(parsed).toEqual(sort)
				}),
				{ numRuns: 100 },
			)
		})

		it("should round-trip field filters correctly", () => {
			fc.assert(
				fc.property(fieldFilterArb, (filter) => {
					// Print filter to object
					const printed = printFilter(filter)
					expect(printed).toBeDefined()

					// Parse back
					const parsed = parseFilter(printed)
					expect(parsed).not.toBeNull()

					// Should be equivalent
					if (parsed && isFieldFilter(parsed)) {
						expect(parsed.field).toBe(filter.field)
						expect(parsed.operator).toBe(filter.operator)
						expect(parsed.value).toEqual(filter.value)
					} else {
						// If parser wrapped in logical, unwrap
						if (parsed && isLogicalFilter(parsed) && parsed.conditions.length === 1) {
							const inner = parsed.conditions[0]
							if (inner && isFieldFilter(inner)) {
								expect(inner.field).toBe(filter.field)
								expect(inner.operator).toBe(filter.operator)
								expect(inner.value).toEqual(filter.value)
							}
						}
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should round-trip logical filters correctly", () => {
			fc.assert(
				fc.property(logicalFilterArb, (filter) => {
					// Print filter to object
					const printed = printFilter(filter)
					expect(printed).toBeDefined()

					// Parse back
					const parsed = parseFilter(printed)
					expect(parsed).not.toBeNull()

					// Should preserve logical operator
					if (parsed && isLogicalFilter(parsed)) {
						expect(parsed.operator).toBe(filter.operator)
						expect(parsed.conditions.length).toBe(filter.conditions.length)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should round-trip complete QueryAST correctly", () => {
			fc.assert(
				fc.property(queryASTArb, (ast) => {
					// Print AST to query params
					const printed = print(ast)

					// Parse back
					const result = parse({
						fields: printed.fields,
						page: printed.page !== undefined ? String(printed.page) : undefined,
						limit: printed.limit !== undefined ? String(printed.limit) : undefined,
						sort: printed.sort,
						filter: printed.filter,
					})

					expect(result.ast).not.toBeNull()

					// Fields should be equivalent
					expect(result.ast?.fields).toEqual(ast.fields)

					// Pagination: page calculation may round, so check limit and recalculated offset
					const expectedPage = Math.floor(ast.pagination.offset / ast.pagination.limit) + 1
					const expectedOffset = (expectedPage - 1) * ast.pagination.limit
					expect(result.ast?.pagination.offset).toBe(expectedOffset)
					expect(result.ast?.pagination.limit).toBe(ast.pagination.limit)

					// Sort should be equivalent
					expect(result.ast?.sort).toEqual(ast.sort)

					// Filter structure should be preserved
					if (ast.filter === null) {
						expect(result.ast?.filter).toBeNull()
					} else {
						expect(result.ast?.filter).not.toBeNull()
						// Deep comparison of filter structure
						compareFilterNodes(ast.filter, result.ast?.filter ?? null)
					}
				}),
				{ numRuns: 100 },
			)
		})
	})
})

/**
 * Helper function to compare two FilterNode structures for equivalence
 */
function compareFilterNodes(original: FilterNode | null, parsed: FilterNode | null): void {
	if (original === null) {
		expect(parsed).toBeNull()
		return
	}

	expect(parsed).not.toBeNull()
	if (!parsed) return

	if (isFieldFilter(original)) {
		if (isFieldFilter(parsed)) {
			expect(parsed.field).toBe(original.field)
			expect(parsed.operator).toBe(original.operator)
			expect(parsed.value).toEqual(original.value)
		} else if (isLogicalFilter(parsed) && parsed.conditions.length === 1) {
			// Parser may wrap single filter in logical
			const inner = parsed.conditions[0]
			if (inner && isFieldFilter(inner)) {
				expect(inner.field).toBe(original.field)
				expect(inner.operator).toBe(original.operator)
				expect(inner.value).toEqual(original.value)
			}
		}
	} else if (isLogicalFilter(original)) {
		expect(isLogicalFilter(parsed)).toBe(true)
		if (isLogicalFilter(parsed)) {
			expect(parsed.operator).toBe(original.operator)
			expect(parsed.conditions.length).toBe(original.conditions.length)
			for (let i = 0; i < original.conditions.length; i++) {
				compareFilterNodes(original.conditions[i] ?? null, parsed.conditions[i] ?? null)
			}
		}
	}
}
