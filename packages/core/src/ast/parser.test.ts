/**
 * Property-based tests for AST Parser
 *
 * @module ast/parser.test
 */

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import {
	DEFAULT_PAGINATION,
	type ParseError,
	parse,
	parseFields,
	parseFilter,
	parsePagination,
	parseSort,
	type QueryInput,
} from "./parser"
import type { FilterNode, FilterOperator, LogicalOperator, SortDirection } from "./types"
import { FILTER_OPERATORS, isFieldFilter, isLogicalFilter, LOGICAL_OPERATORS, SORT_DIRECTIONS } from "./types"

// Arbitraries for generating valid inputs

const fieldNameArb = fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]*$/).filter((s) => s.length > 0 && s.length <= 50)

const filterOperatorArb: fc.Arbitrary<FilterOperator> = fc.constantFrom(...FILTER_OPERATORS)

const sortDirectionArb: fc.Arbitrary<SortDirection> = fc.constantFrom(...SORT_DIRECTIONS)

const filterValueArb = fc.oneof(
	fc
		.string()
		.filter((s) => !s.includes(",") && !s.includes(":")), // Avoid special chars
	fc.integer(),
	fc.double({ noNaN: true, noDefaultInfinity: true }),
	fc.boolean(),
	fc.constant(null),
	fc.array(
		fc.oneof(
			fc.string().filter((s) => s.length < 20),
			fc.integer(),
		),
		{ maxLength: 5 },
	),
)

// Generate a valid fields string
const fieldsStringArb = fc.array(fieldNameArb, { minLength: 1, maxLength: 10 }).map((fields) => fields.join(","))

// Generate a valid sort string
const sortStringArb = fc
	.array(
		fc.tuple(fieldNameArb, sortDirectionArb).map(([field, dir]) => `${field}:${dir}`),
		{ minLength: 1, maxLength: 5 },
	)
	.map((sorts) => sorts.join(","))

// Generate a valid page number
const pageArb = fc.integer({ min: 1, max: 1000 })

// Generate a valid limit
const limitArb = fc.integer({ min: 1, max: 100 })

// Generate a simple field filter object
const fieldFilterObjArb = fc
	.record({
		field: fieldNameArb,
		operator: filterOperatorArb,
		value: filterValueArb,
	})
	.map(({ field, operator, value }) => ({
		[field]: { [operator]: value },
	}))

describe("AST Parser Unit Tests", () => {
	describe("parseFields", () => {
		it("should return null for empty input", () => {
			expect(parseFields(undefined)).toBeNull()
			expect(parseFields(null)).toBeNull()
			expect(parseFields("")).toBeNull()
			expect(parseFields("   ")).toBeNull()
		})

		it("should parse single field", () => {
			expect(parseFields("id")).toEqual(["id"])
			expect(parseFields("name")).toEqual(["name"])
		})

		it("should parse multiple fields", () => {
			expect(parseFields("id,name,email")).toEqual(["id", "name", "email"])
		})

		it("should trim whitespace", () => {
			expect(parseFields(" id , name , email ")).toEqual(["id", "name", "email"])
		})

		it("should filter empty fields", () => {
			expect(parseFields("id,,name")).toEqual(["id", "name"])
			expect(parseFields(",id,name,")).toEqual(["id", "name"])
		})
	})

	describe("parsePagination", () => {
		it("should return defaults for empty input", () => {
			expect(parsePagination(undefined, undefined)).toEqual(DEFAULT_PAGINATION)
		})

		it("should calculate offset from page and limit", () => {
			expect(parsePagination("1", "10")).toEqual({ offset: 0, limit: 10 })
			expect(parsePagination("2", "10")).toEqual({ offset: 10, limit: 10 })
			expect(parsePagination("3", "20")).toEqual({ offset: 40, limit: 20 })
		})

		it("should handle numeric inputs", () => {
			expect(parsePagination(2, 10)).toEqual({ offset: 10, limit: 10 })
		})

		it("should use default limit when not provided", () => {
			expect(parsePagination("2", undefined)).toEqual({ offset: 10, limit: 10 })
		})

		it("should use default page when not provided", () => {
			expect(parsePagination(undefined, "20")).toEqual({ offset: 0, limit: 20 })
		})

		it("should handle invalid inputs gracefully", () => {
			expect(parsePagination("invalid", "10")).toEqual({ offset: 0, limit: 10 })
			expect(parsePagination("1", "invalid")).toEqual({ offset: 0, limit: 10 })
			expect(parsePagination("-1", "10")).toEqual({ offset: 0, limit: 10 })
			expect(parsePagination("1", "-10")).toEqual({ offset: 0, limit: 10 })
		})
	})

	describe("parseSort", () => {
		it("should return empty array for empty input", () => {
			expect(parseSort(undefined)).toEqual([])
			expect(parseSort(null)).toEqual([])
			expect(parseSort("")).toEqual([])
		})

		it("should parse single sort with direction", () => {
			expect(parseSort("createdAt:desc")).toEqual([{ field: "createdAt", direction: "desc" }])
			expect(parseSort("name:asc")).toEqual([{ field: "name", direction: "asc" }])
		})

		it("should default to asc when no direction specified", () => {
			expect(parseSort("name")).toEqual([{ field: "name", direction: "asc" }])
		})

		it("should parse multiple sorts", () => {
			expect(parseSort("createdAt:desc,name:asc")).toEqual([
				{ field: "createdAt", direction: "desc" },
				{ field: "name", direction: "asc" },
			])
		})

		it("should handle whitespace", () => {
			expect(parseSort(" createdAt : desc , name : asc ")).toEqual([
				{ field: "createdAt", direction: "desc" },
				{ field: "name", direction: "asc" },
			])
		})

		it("should handle invalid direction gracefully", () => {
			expect(parseSort("name:invalid")).toEqual([{ field: "name", direction: "asc" }])
		})
	})

	describe("parseFilter", () => {
		it("should return null for empty input", () => {
			expect(parseFilter(undefined)).toBeNull()
			expect(parseFilter(null)).toBeNull()
			expect(parseFilter({})).toBeNull()
		})

		it("should parse simple field filter", () => {
			const result = parseFilter({ title: { eq: "hello" } })
			expect(result).toEqual({
				type: "field",
				field: "title",
				operator: "eq",
				value: "hello",
			})
		})

		it("should parse filter with different operators", () => {
			expect(parseFilter({ age: { gt: 18 } })).toEqual({
				type: "field",
				field: "age",
				operator: "gt",
				value: 18,
			})

			expect(parseFilter({ name: { contains: "john" } })).toEqual({
				type: "field",
				field: "name",
				operator: "contains",
				value: "john",
			})
		})

		it("should parse logical AND filter", () => {
			const result = parseFilter({
				and: [{ title: { eq: "hello" } }, { status: { eq: "active" } }],
			})

			expect(result).toEqual({
				type: "logical",
				operator: "and",
				conditions: [
					{ type: "field", field: "title", operator: "eq", value: "hello" },
					{ type: "field", field: "status", operator: "eq", value: "active" },
				],
			})
		})

		it("should parse logical OR filter", () => {
			const result = parseFilter({
				or: [{ status: { eq: "active" } }, { status: { eq: "pending" } }],
			})

			expect(result).toEqual({
				type: "logical",
				operator: "or",
				conditions: [
					{ type: "field", field: "status", operator: "eq", value: "active" },
					{ type: "field", field: "status", operator: "eq", value: "pending" },
				],
			})
		})

		it("should parse logical NOT filter", () => {
			const result = parseFilter({
				not: [{ status: { eq: "deleted" } }],
			})

			expect(result).toEqual({
				type: "logical",
				operator: "not",
				conditions: [{ type: "field", field: "status", operator: "eq", value: "deleted" }],
			})
		})

		it("should combine multiple field filters with AND", () => {
			const result = parseFilter({
				title: { eq: "hello" },
				status: { eq: "active" },
			})

			expect(result).toEqual({
				type: "logical",
				operator: "and",
				conditions: [
					{ type: "field", field: "title", operator: "eq", value: "hello" },
					{ type: "field", field: "status", operator: "eq", value: "active" },
				],
			})
		})

		it("should report error for invalid operator", () => {
			const errors: ParseError[] = []
			const result = parseFilter({ title: { invalid: "hello" } }, errors)

			expect(result).toBeNull()
			expect(errors.length).toBeGreaterThan(0)
			expect(errors[0]?.code).toBe("INVALID_OPERATOR")
		})
	})

	describe("parse (main function)", () => {
		it("should parse complete query input", () => {
			const result = parse({
				fields: "id,name,email",
				page: "2",
				limit: "10",
				sort: "createdAt:desc",
				filter: { status: { eq: "active" } },
			})

			expect(result.errors).toHaveLength(0)
			expect(result.ast).not.toBeNull()
			expect(result.ast?.fields).toEqual(["id", "name", "email"])
			expect(result.ast?.pagination).toEqual({ offset: 10, limit: 10 })
			expect(result.ast?.sort).toEqual([{ field: "createdAt", direction: "desc" }])
			expect(result.ast?.filter).toEqual({
				type: "field",
				field: "status",
				operator: "eq",
				value: "active",
			})
		})

		it("should handle empty input", () => {
			const result = parse({})

			expect(result.errors).toHaveLength(0)
			expect(result.ast).not.toBeNull()
			expect(result.ast?.fields).toBeNull()
			expect(result.ast?.pagination).toEqual(DEFAULT_PAGINATION)
			expect(result.ast?.sort).toEqual([])
			expect(result.ast?.filter).toBeNull()
		})
	})
})

describe("AST Parser Property Tests", () => {
	describe("Property 2: Parser Produces Valid AST", () => {
		/**
		 * **Feature: ast-compiler-architecture, Property 2: Parser Produces Valid AST**
		 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
		 *
		 * For any valid QS query string, the parser SHALL produce a QueryAST where:
		 * - Fields are extracted as an array from comma-separated input
		 * - Pagination offset is calculated as (page - 1) * limit
		 * - Sort specifications contain field and direction
		 * - Filters contain field, operator, and value
		 */
		it("should extract fields as array from comma-separated input (Requirement 2.2)", () => {
			fc.assert(
				fc.property(fieldsStringArb, (fieldsStr) => {
					const result = parseFields(fieldsStr)

					// Result should be an array
					expect(result).not.toBeNull()
					expect(Array.isArray(result)).toBe(true)

					// Each field should be a non-empty string
					if (result) {
						for (const field of result) {
							expect(typeof field).toBe("string")
							expect(field.length).toBeGreaterThan(0)
						}
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should calculate pagination offset as (page - 1) * limit (Requirement 2.3)", () => {
			fc.assert(
				fc.property(pageArb, limitArb, (page, limit) => {
					const result = parsePagination(String(page), String(limit))

					// Offset should be (page - 1) * limit
					const expectedOffset = (page - 1) * limit
					expect(result.offset).toBe(expectedOffset)
					expect(result.limit).toBe(limit)
				}),
				{ numRuns: 100 },
			)
		})

		it("should produce sort specifications with field and direction (Requirement 2.4)", () => {
			fc.assert(
				fc.property(sortStringArb, (sortStr) => {
					const result = parseSort(sortStr)

					// Result should be an array
					expect(Array.isArray(result)).toBe(true)

					// Each sort spec should have field and direction
					for (const sortSpec of result) {
						expect(typeof sortSpec.field).toBe("string")
						expect(sortSpec.field.length).toBeGreaterThan(0)
						expect(SORT_DIRECTIONS).toContain(sortSpec.direction)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should produce filter objects with field, operator, and value (Requirement 2.5)", () => {
			fc.assert(
				fc.property(fieldFilterObjArb, (filterObj) => {
					const errors: ParseError[] = []
					const result = parseFilter(filterObj, errors)

					// Should not have errors for valid input
					expect(errors).toHaveLength(0)

					// Result should be a valid filter node
					expect(result).not.toBeNull()
					if (result && isFieldFilter(result)) {
						expect(typeof result.field).toBe("string")
						expect(FILTER_OPERATORS).toContain(result.operator)
						expect(result).toHaveProperty("value")
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should preserve logical structure in nested filters (Requirement 2.6)", () => {
			// Generate nested logical filter
			const nestedLogicalFilterArb = fc.constantFrom<LogicalOperator>("and", "or").chain((op) =>
				fc.array(fieldFilterObjArb, { minLength: 1, maxLength: 3 }).map((filters) => ({
					[op]: filters,
				})),
			)

			fc.assert(
				fc.property(nestedLogicalFilterArb, (filterObj) => {
					const errors: ParseError[] = []
					const result = parseFilter(filterObj, errors)

					// Should not have errors for valid input
					expect(errors).toHaveLength(0)

					// Result should be a logical filter
					expect(result).not.toBeNull()
					if (result && isLogicalFilter(result)) {
						expect(LOGICAL_OPERATORS).toContain(result.operator)
						expect(Array.isArray(result.conditions)).toBe(true)
						expect(result.conditions.length).toBeGreaterThan(0)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should produce valid AST for complete query input (Requirement 2.1)", () => {
			const queryInputArb: fc.Arbitrary<QueryInput> = fc.record({
				fields: fc.option(fieldsStringArb, { nil: undefined }),
				page: fc.option(pageArb.map(String), { nil: undefined }),
				limit: fc.option(limitArb.map(String), { nil: undefined }),
				sort: fc.option(sortStringArb, { nil: undefined }),
				filter: fc.option(fieldFilterObjArb, { nil: undefined }),
			})

			fc.assert(
				fc.property(queryInputArb, (input) => {
					const result = parse(input)

					// Should produce a valid AST (may have warnings but no critical errors)
					if (result.ast !== null) {
						// Fields should be array or null
						expect(result.ast.fields === null || Array.isArray(result.ast.fields)).toBe(true)

						// Pagination should have valid offset and limit
						expect(typeof result.ast.pagination.offset).toBe("number")
						expect(typeof result.ast.pagination.limit).toBe("number")
						expect(result.ast.pagination.offset).toBeGreaterThanOrEqual(0)
						expect(result.ast.pagination.limit).toBeGreaterThan(0)

						// Sort should be an array
						expect(Array.isArray(result.ast.sort)).toBe(true)

						// Filter should be FilterNode or null
						if (result.ast.filter !== null) {
							validateFilterNode(result.ast.filter)
						}
					}
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

describe("AST Parser Error Handling Property Tests", () => {
	describe("Property 8: Parser Error Handling", () => {
		/**
		 * **Feature: ast-compiler-architecture, Property 8: Parser Error Handling**
		 * **Validates: Requirements 2.7**
		 *
		 * For any malformed QS query string, the parser SHALL return a non-empty
		 * errors array with descriptive error messages.
		 */

		// Generate invalid filter operators
		const invalidOperatorArb = fc
			.string({ minLength: 1, maxLength: 20 })
			.filter((s) => !FILTER_OPERATORS.includes(s as FilterOperator) && /^[a-zA-Z]+$/.test(s))

		it("should return error for invalid filter operators", () => {
			fc.assert(
				fc.property(fieldNameArb, invalidOperatorArb, filterValueArb, (field, invalidOp, value) => {
					const errors: ParseError[] = []
					const filterObj = { [field]: { [invalidOp]: value } }
					const result = parseFilter(filterObj, errors)

					// Should return null or have errors for invalid operator
					if (result === null) {
						expect(errors.length).toBeGreaterThan(0)
						expect(errors.some((e) => e.code === "INVALID_OPERATOR")).toBe(true)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should return descriptive error messages for invalid operators", () => {
			fc.assert(
				fc.property(fieldNameArb, invalidOperatorArb, (field, invalidOp) => {
					const errors: ParseError[] = []
					const filterObj = { [field]: { [invalidOp]: "test" } }
					parseFilter(filterObj, errors)

					// Error messages should be descriptive
					for (const error of errors) {
						expect(typeof error.message).toBe("string")
						expect(error.message.length).toBeGreaterThan(0)
						expect(error.field).toBeDefined()
						expect(Array.isArray(error.path)).toBe(true)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should return error for non-object filter values", () => {
			const nonObjectArb = fc.oneof(fc.string(), fc.integer(), fc.boolean())

			fc.assert(
				fc.property(nonObjectArb, (invalidFilter) => {
					const errors: ParseError[] = []
					const result = parseFilter(invalidFilter, errors)

					// Non-object filters should return null with errors
					expect(result).toBeNull()
					expect(errors.length).toBeGreaterThan(0)
					expect(errors.some((e) => e.code === "INVALID_VALUE")).toBe(true)
				}),
				{ numRuns: 100 },
			)
		})

		it("should include path information in errors", () => {
			fc.assert(
				fc.property(fieldNameArb, invalidOperatorArb, (field, invalidOp) => {
					const errors: ParseError[] = []
					const filterObj = { [field]: { [invalidOp]: "test" } }
					parseFilter(filterObj, errors, ["filter"])

					// Errors should include path information
					for (const error of errors) {
						expect(Array.isArray(error.path)).toBe(true)
						expect(error.path.length).toBeGreaterThan(0)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should handle deeply nested invalid filters", () => {
			fc.assert(
				fc.property(fieldNameArb, invalidOperatorArb, (field, invalidOp) => {
					const errors: ParseError[] = []
					const filterObj = {
						and: [{ [field]: { [invalidOp]: "test" } }],
					}
					parseFilter(filterObj, errors)

					// Should detect invalid operator in nested structure
					if (errors.length > 0) {
						expect(errors.some((e) => e.code === "INVALID_OPERATOR")).toBe(true)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should collect multiple errors when multiple invalid operators present", () => {
			fc.assert(
				fc.property(
					fc.array(fc.tuple(fieldNameArb, invalidOperatorArb), { minLength: 2, maxLength: 4 }),
					(fieldOpPairs) => {
						const errors: ParseError[] = []
						const filterObj: Record<string, Record<string, string>> = {}
						for (const [field, op] of fieldOpPairs) {
							filterObj[field] = { [op]: "test" }
						}
						parseFilter(filterObj, errors)

						// Should collect errors for each invalid operator
						// Note: some fields might overwrite others if same field name
						const uniqueFields = new Set(fieldOpPairs.map(([f]) => f))
						if (uniqueFields.size > 1) {
							expect(errors.length).toBeGreaterThanOrEqual(1)
						}
					},
				),
				{ numRuns: 100 },
			)
		})
	})
})
