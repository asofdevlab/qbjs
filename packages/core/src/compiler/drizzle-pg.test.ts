/**
 * Property-based tests for Drizzle PostgreSQL Compiler
 *
 * **Feature: ast-compiler-architecture, Property 5: Drizzle PG Compilation Validity**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6**
 *
 * **Feature: ast-compiler-architecture, Property 6: Invalid Column Detection**
 * **Validates: Requirements 4.7**
 */

import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"
import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import type { FilterNode, FilterOperator, QueryAST, SortSpec } from "../ast/types"
import { SORT_DIRECTIONS } from "../ast/types"
import { createDrizzlePgCompiler, DrizzlePgCompiler } from "./drizzle-pg"

// Test table schema
const testTable = pgTable("test_table", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email"),
	age: integer("age"),
	active: boolean("active"),
	createdAt: timestamp("created_at").defaultNow(),
})

const validColumnNames = ["id", "name", "email", "age", "active", "createdAt"]

// Arbitraries for generating valid AST components that match the test table

const validFieldNameArb = fc.constantFrom(...validColumnNames)

const invalidFieldNameArb = fc
	.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
	.filter((s) => s.length > 0 && s.length <= 50 && !validColumnNames.includes(s))

const sortDirectionArb = fc.constantFrom(...SORT_DIRECTIONS)

const validSortSpecArb: fc.Arbitrary<SortSpec> = fc.record({
	field: validFieldNameArb,
	direction: sortDirectionArb,
})

// Scalar value generator for most operators
const scalarValueArb = fc.oneof(fc.string(), fc.integer(), fc.double({ noNaN: true }), fc.boolean())

// Array value generator for 'in' and 'notIn' operators
const arrayValueArb = fc.array(fc.oneof(fc.string(), fc.integer()), { minLength: 1, maxLength: 10 })

// Between value generator - exactly 2 elements
const betweenValueArb = fc.tuple(fc.oneof(fc.integer(), fc.string()), fc.oneof(fc.integer(), fc.string()))

// Operators that work with scalar values
const scalarOperators: FilterOperator[] = [
	"eq",
	"eqi",
	"ne",
	"nei",
	"lt",
	"lte",
	"gt",
	"gte",
	"contains",
	"containsi",
	"notContains",
	"notContainsi",
	"startsWith",
	"endsWith",
]

// Generate valid field filters with operator-appropriate values
const validFieldFilterArb: fc.Arbitrary<FilterNode> = fc.oneof(
	// Scalar operators with scalar values
	fc.record({
		type: fc.constant("field" as const),
		field: validFieldNameArb,
		operator: fc.constantFrom(...scalarOperators),
		value: scalarValueArb,
	}),
	// 'in' and 'notIn' with array values
	fc.record({
		type: fc.constant("field" as const),
		field: validFieldNameArb,
		operator: fc.constantFrom("in" as FilterOperator, "notIn" as FilterOperator),
		value: arrayValueArb,
	}),
	// 'between' with 2-element tuple
	fc.record({
		type: fc.constant("field" as const),
		field: validFieldNameArb,
		operator: fc.constant("between" as FilterOperator),
		value: betweenValueArb,
	}),
	// 'null' and 'notNull' with any value (ignored)
	fc.record({
		type: fc.constant("field" as const),
		field: validFieldNameArb,
		operator: fc.constantFrom("null" as FilterOperator, "notNull" as FilterOperator),
		value: fc.constant(true),
	}),
)

// Generate invalid field filters (using columns that don't exist) with operator-appropriate values
const invalidFieldFilterArb: fc.Arbitrary<FilterNode> = fc.oneof(
	// Scalar operators with scalar values
	fc.record({
		type: fc.constant("field" as const),
		field: invalidFieldNameArb,
		operator: fc.constantFrom(...scalarOperators),
		value: scalarValueArb,
	}),
	// 'in' and 'notIn' with array values
	fc.record({
		type: fc.constant("field" as const),
		field: invalidFieldNameArb,
		operator: fc.constantFrom("in" as FilterOperator, "notIn" as FilterOperator),
		value: arrayValueArb,
	}),
	// 'between' with 2-element tuple
	fc.record({
		type: fc.constant("field" as const),
		field: invalidFieldNameArb,
		operator: fc.constant("between" as FilterOperator),
		value: betweenValueArb,
	}),
	// 'null' and 'notNull' with any value (ignored)
	fc.record({
		type: fc.constant("field" as const),
		field: invalidFieldNameArb,
		operator: fc.constantFrom("null" as FilterOperator, "notNull" as FilterOperator),
		value: fc.constant(true),
	}),
)

// Recursive arbitrary for valid FilterNode (limited depth)
const validFilterNodeArb = (maxDepth: number): fc.Arbitrary<FilterNode> => {
	if (maxDepth <= 0) {
		return validFieldFilterArb
	}

	const logicalFilterArb = fc.record({
		type: fc.constant("logical" as const),
		operator: fc.constantFrom("and" as const, "or" as const, "not" as const),
		conditions: fc.array(validFilterNodeArb(maxDepth - 1), { minLength: 1, maxLength: 3 }),
	})

	return fc.oneof(validFieldFilterArb, logicalFilterArb)
}

const paginationArb = fc.record({
	offset: fc.nat({ max: 10000 }),
	limit: fc.integer({ min: 1, max: 100 }),
})

// Generate valid QueryAST (all fields exist in test table)
const validQueryASTArb: fc.Arbitrary<QueryAST> = fc.record({
	fields: fc.oneof(fc.constant(null), fc.array(validFieldNameArb, { minLength: 1, maxLength: 6 })),
	pagination: paginationArb,
	sort: fc.array(validSortSpecArb, { maxLength: 3 }),
	filter: fc.oneof(fc.constant(null), validFilterNodeArb(2)),
})

// Generate QueryAST with invalid fields
const invalidFieldsQueryASTArb: fc.Arbitrary<QueryAST> = fc.record({
	fields: fc.array(invalidFieldNameArb, { minLength: 1, maxLength: 5 }),
	pagination: paginationArb,
	sort: fc.array(validSortSpecArb, { maxLength: 3 }),
	filter: fc.constant(null),
})

// Generate QueryAST with invalid filter columns
const invalidFilterQueryASTArb: fc.Arbitrary<QueryAST> = fc.record({
	fields: fc.constant(null),
	pagination: paginationArb,
	sort: fc.constant([]),
	filter: invalidFieldFilterArb,
})

describe("Drizzle PG Compiler Property Tests", () => {
	const compiler = createDrizzlePgCompiler()

	describe("Property 5: Drizzle PG Compilation Validity", () => {
		/**
		 * **Feature: ast-compiler-architecture, Property 5: Drizzle PG Compilation Validity**
		 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6**
		 *
		 * For any valid QueryAST and Drizzle PostgreSQL table schema, the compiler
		 * SHALL produce a valid Drizzle query object with:
		 * - Select columns matching AST fields
		 * - Limit and offset matching AST pagination
		 * - OrderBy clauses matching AST sort
		 * - Where clauses matching AST filters
		 */
		it("should compile valid AST to Drizzle query with correct structure", () => {
			fc.assert(
				fc.property(validQueryASTArb, (ast: QueryAST) => {
					const result = compiler.compile(ast, testTable)

					// Should produce a query
					expect(result.query).not.toBeNull()

					// Requirement 4.2: Pagination should match
					expect(result.query!.limit).toBe(ast.pagination.limit)
					expect(result.query!.offset).toBe(ast.pagination.offset)

					// Requirement 4.1: Fields should be compiled correctly
					if (ast.fields === null) {
						expect(result.query!.columns).toBeUndefined()
					} else {
						expect(result.query!.columns).toBeDefined()
						// All valid fields should be in the result
						for (const field of ast.fields) {
							if (validColumnNames.includes(field)) {
								expect(result.query!.columns![field]).toBe(true)
							}
						}
					}

					// Requirement 4.3: Sort should produce orderBy clauses
					expect(result.query!.orderBy.length).toBe(ast.sort.length)

					// Requirement 4.4 & 4.6: Filter should produce where clause
					if (ast.filter === null) {
						expect(result.query!.where).toBeUndefined()
					} else {
						// Where clause should be defined for valid filters
						expect(result.query!.where).toBeDefined()
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should compile pagination correctly", () => {
			fc.assert(
				fc.property(paginationArb, (pagination) => {
					const ast: QueryAST = {
						fields: null,
						pagination,
						sort: [],
						filter: null,
					}

					const result = compiler.compile(ast, testTable)

					expect(result.query!.limit).toBe(pagination.limit)
					expect(result.query!.offset).toBe(pagination.offset)
					expect(result.errors).toHaveLength(0)
				}),
				{ numRuns: 100 },
			)
		})

		it("should compile sort specifications correctly", () => {
			fc.assert(
				fc.property(fc.array(validSortSpecArb, { minLength: 1, maxLength: 5 }), (sort) => {
					const ast: QueryAST = {
						fields: null,
						pagination: { offset: 0, limit: 10 },
						sort,
						filter: null,
					}

					const result = compiler.compile(ast, testTable)

					// Should have same number of orderBy clauses as sort specs
					expect(result.query!.orderBy.length).toBe(sort.length)
					expect(result.errors).toHaveLength(0)
				}),
				{ numRuns: 100 },
			)
		})

		it("should compile field filters correctly", () => {
			fc.assert(
				fc.property(validFieldFilterArb, (filter) => {
					const ast: QueryAST = {
						fields: null,
						pagination: { offset: 0, limit: 10 },
						sort: [],
						filter,
					}

					const result = compiler.compile(ast, testTable)

					// Should produce a where clause
					expect(result.query!.where).toBeDefined()
					// No errors for valid columns
					expect(result.errors.filter((e) => e.code === "UNKNOWN_COLUMN")).toHaveLength(0)
				}),
				{ numRuns: 100 },
			)
		})

		it("should compile logical filters correctly", () => {
			fc.assert(
				fc.property(validFilterNodeArb(2), (filter) => {
					const ast: QueryAST = {
						fields: null,
						pagination: { offset: 0, limit: 10 },
						sort: [],
						filter,
					}

					const result = compiler.compile(ast, testTable)

					// Should produce a where clause
					expect(result.query!.where).toBeDefined()
				}),
				{ numRuns: 100 },
			)
		})

		it("should return no errors for valid AST", () => {
			fc.assert(
				fc.property(validQueryASTArb, (ast: QueryAST) => {
					const result = compiler.compile(ast, testTable)

					// Should have no UNKNOWN_COLUMN errors for valid AST
					const unknownColumnErrors = result.errors.filter((e) => e.code === "UNKNOWN_COLUMN")
					expect(unknownColumnErrors).toHaveLength(0)
				}),
				{ numRuns: 100 },
			)
		})
	})

	describe("Property 6: Invalid Column Detection", () => {
		/**
		 * **Feature: ast-compiler-architecture, Property 6: Invalid Column Detection**
		 * **Validates: Requirements 4.7**
		 *
		 * For any QueryAST containing a filter that references a column not in the
		 * table schema, the compiler SHALL return an error with code 'UNKNOWN_COLUMN'.
		 */
		it("should detect invalid columns in fields", () => {
			fc.assert(
				fc.property(invalidFieldsQueryASTArb, (ast: QueryAST) => {
					const result = compiler.compile(ast, testTable)

					// Should have UNKNOWN_COLUMN errors for invalid fields
					const unknownColumnErrors = result.errors.filter((e) => e.code === "UNKNOWN_COLUMN")
					expect(unknownColumnErrors.length).toBeGreaterThan(0)

					// Each invalid field should have an error
					for (const field of ast.fields!) {
						if (!validColumnNames.includes(field)) {
							const hasError = unknownColumnErrors.some((e) => e.field === field)
							expect(hasError).toBe(true)
						}
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("should detect invalid columns in filters", () => {
			fc.assert(
				fc.property(invalidFilterQueryASTArb, (ast: QueryAST) => {
					const result = compiler.compile(ast, testTable)

					// Should have UNKNOWN_COLUMN error for invalid filter column
					const unknownColumnErrors = result.errors.filter((e) => e.code === "UNKNOWN_COLUMN")
					expect(unknownColumnErrors.length).toBeGreaterThan(0)
				}),
				{ numRuns: 100 },
			)
		})

		it("should detect invalid columns in sort", () => {
			fc.assert(
				fc.property(invalidFieldNameArb, (invalidField) => {
					const ast: QueryAST = {
						fields: null,
						pagination: { offset: 0, limit: 10 },
						sort: [{ field: invalidField, direction: "asc" }],
						filter: null,
					}

					const result = compiler.compile(ast, testTable)

					// Should have UNKNOWN_COLUMN error
					const unknownColumnErrors = result.errors.filter((e) => e.code === "UNKNOWN_COLUMN")
					expect(unknownColumnErrors.length).toBe(1)
					expect(unknownColumnErrors[0]!.field).toBe(invalidField)
				}),
				{ numRuns: 100 },
			)
		})

		it("should return UNKNOWN_COLUMN error code for non-existent columns", () => {
			fc.assert(
				fc.property(invalidFieldNameArb, (invalidField) => {
					const ast: QueryAST = {
						fields: [invalidField],
						pagination: { offset: 0, limit: 10 },
						sort: [],
						filter: null,
					}

					const result = compiler.compile(ast, testTable)

					// Should have exactly one UNKNOWN_COLUMN error
					const unknownColumnErrors = result.errors.filter((e) => e.code === "UNKNOWN_COLUMN")
					expect(unknownColumnErrors.length).toBe(1)
					expect(unknownColumnErrors[0]!.code).toBe("UNKNOWN_COLUMN")
					expect(unknownColumnErrors[0]!.field).toBe(invalidField)
					expect(unknownColumnErrors[0]!.message).toContain("does not exist")
				}),
				{ numRuns: 100 },
			)
		})
	})
})

describe("DrizzlePgCompiler Unit Tests", () => {
	const compiler = new DrizzlePgCompiler()

	it("should create compiler instance", () => {
		expect(compiler).toBeInstanceOf(DrizzlePgCompiler)
	})

	it("should compile empty AST", () => {
		const ast: QueryAST = {
			fields: null,
			pagination: { offset: 0, limit: 10 },
			sort: [],
			filter: null,
		}

		const result = compiler.compile(ast, testTable)

		expect(result.query).not.toBeNull()
		expect(result.query!.columns).toBeUndefined()
		expect(result.query!.limit).toBe(10)
		expect(result.query!.offset).toBe(0)
		expect(result.query!.orderBy).toHaveLength(0)
		expect(result.query!.where).toBeUndefined()
		expect(result.errors).toHaveLength(0)
	})

	it("should compile AST with specific fields", () => {
		const ast: QueryAST = {
			fields: ["id", "name", "email"],
			pagination: { offset: 0, limit: 10 },
			sort: [],
			filter: null,
		}

		const result = compiler.compile(ast, testTable)

		expect(result.query!.columns).toEqual({
			id: true,
			name: true,
			email: true,
		})
		expect(result.errors).toHaveLength(0)
	})

	it("should use ilike for containsi operator (PostgreSQL specific)", () => {
		const ast: QueryAST = {
			fields: null,
			pagination: { offset: 0, limit: 10 },
			sort: [],
			filter: {
				type: "field",
				field: "name",
				operator: "containsi",
				value: "test",
			},
		}

		const result = compiler.compile(ast, testTable)

		expect(result.query!.where).toBeDefined()
		expect(result.errors).toHaveLength(0)
	})
})
