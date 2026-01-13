/**
 * Property-based tests for filter helper functions
 *
 * Feature: qbjs-client-enhancement
 * @module filter.test
 */

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import { buildQuery, f, filter } from "./index"
import { FILTER_OPERATORS, type Filter } from "./types"

describe("Filter Helpers", () => {
	/**
	 * Feature: qbjs-client-enhancement, Property 1: Filter Operators Produce Correct Structure
	 * For any filter operator and valid input value, the corresponding filter helper function
	 * SHALL produce an object with the operator as key and the value as the value.
	 * **Validates: Requirements 1.1**
	 */
	describe("Property 1: Filter Operators Produce Correct Structure", () => {
		// Test equality operators with any value
		it.each([
			["eq", (v: unknown) => filter.eq(v), "eq"],
			["ne", (v: unknown) => filter.ne(v), "ne"],
		])("%s operator produces correct structure for any value", (name, fn, expectedKey) => {
			fc.assert(
				fc.property(fc.anything(), (value) => {
					const result = fn(value)
					expect(result).toHaveProperty(expectedKey)
					expect(result[expectedKey as keyof typeof result]).toBe(value)
				}),
				{ numRuns: 100 },
			)
		})

		// Test case-insensitive string operators
		it.each([
			["eqi", filter.eqi, "eqi"],
			["nei", filter.nei, "nei"],
			["contains", filter.contains, "contains"],
			["containsi", filter.containsi, "containsi"],
			["notContains", filter.notContains, "notContains"],
			["notContainsi", filter.notContainsi, "notContainsi"],
			["startsWith", filter.startsWith, "startsWith"],
			["endsWith", filter.endsWith, "endsWith"],
		])("%s operator produces correct structure for any string", (name, fn, expectedKey) => {
			fc.assert(
				fc.property(fc.string(), (value) => {
					const result = fn(value)
					expect(result).toHaveProperty(expectedKey)
					expect(result[expectedKey as keyof typeof result]).toBe(value)
				}),
				{ numRuns: 100 },
			)
		})

		// Test comparison operators with numbers
		it.each([
			["lt", (v: number) => filter.lt(v), "lt"],
			["lte", (v: number) => filter.lte(v), "lte"],
			["gt", (v: number) => filter.gt(v), "gt"],
			["gte", (v: number) => filter.gte(v), "gte"],
		])("%s operator produces correct structure for any number", (name, fn, expectedKey) => {
			fc.assert(
				fc.property(fc.double({ noNaN: true }), (value) => {
					const result = fn(value)
					expect(result).toHaveProperty(expectedKey)
					expect(result[expectedKey as keyof typeof result]).toBe(value)
				}),
				{ numRuns: 100 },
			)
		})

		// Test array operators
		it.each([
			["in", (v: unknown[]) => filter.in(v), "in"],
			["notIn", (v: unknown[]) => filter.notIn(v), "notIn"],
		])("%s operator produces correct structure for any array", (name, fn, expectedKey) => {
			fc.assert(
				fc.property(fc.array(fc.anything()), (values) => {
					const result = fn(values)
					expect(result).toHaveProperty(expectedKey)
					expect(result[expectedKey as keyof typeof result]).toEqual(values)
				}),
				{ numRuns: 100 },
			)
		})

		// Test between operator
		it("between operator produces correct structure with min and max", () => {
			fc.assert(
				fc.property(fc.double({ noNaN: true }), fc.double({ noNaN: true }), (min, max) => {
					const result = filter.between(min, max)
					expect(result).toHaveProperty("between")
					expect(result.between).toEqual([min, max])
				}),
				{ numRuns: 100 },
			)
		})

		// Test null check operators
		it("isNull operator produces { null: true }", () => {
			const result = filter.isNull()
			expect(result).toEqual({ null: true })
		})

		it("isNotNull operator produces { notNull: true }", () => {
			const result = filter.isNotNull()
			expect(result).toEqual({ notNull: true })
		})

		// Test that f alias works identically to filter
		it("f alias produces identical results to filter", () => {
			fc.assert(
				fc.property(fc.anything(), (value) => {
					expect(f.eq(value)).toEqual(filter.eq(value))
					expect(f.ne(value)).toEqual(filter.ne(value))
				}),
				{ numRuns: 100 },
			)
		})

		// Verify all FILTER_OPERATORS have corresponding helper functions
		it("all filter operators have corresponding helper functions", () => {
			const helperOperators = new Set([
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
				"null", // isNull
				"notNull", // isNotNull
				"between",
			])

			for (const op of FILTER_OPERATORS) {
				expect(helperOperators.has(op)).toBe(true)
			}
		})
	})

	/**
	 * Feature: qbjs-client-enhancement, Property 3: Logical Operators Produce Correct Nested Structure
	 * For any combination of filters wrapped in and(), or(), or not() helpers,
	 * the resulting structure SHALL have the logical operator as the key with the filters as children.
	 * **Validates: Requirements 1.4**
	 */
	describe("Property 3: Logical Operators Produce Correct Nested Structure", () => {
		// Arbitrary for generating simple field filters
		const simpleFilterArb = fc
			.record({
				field: fc.string({ minLength: 1 }),
				value: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
			})
			.map(({ field, value }) => ({ [field]: filter.eq(value) }) as Filter)

		it("and() produces { and: [...filters] } structure", () => {
			fc.assert(
				fc.property(fc.array(simpleFilterArb, { minLength: 1, maxLength: 5 }), (filters) => {
					const result = filter.and(...filters)
					expect(result).toHaveProperty("and")
					expect(Array.isArray(result.and)).toBe(true)
					expect(result.and).toHaveLength(filters.length)
					expect(result.and).toEqual(filters)
				}),
				{ numRuns: 100 },
			)
		})

		it("or() produces { or: [...filters] } structure", () => {
			fc.assert(
				fc.property(fc.array(simpleFilterArb, { minLength: 1, maxLength: 5 }), (filters) => {
					const result = filter.or(...filters)
					expect(result).toHaveProperty("or")
					expect(Array.isArray(result.or)).toBe(true)
					expect(result.or).toHaveLength(filters.length)
					expect(result.or).toEqual(filters)
				}),
				{ numRuns: 100 },
			)
		})

		it("not() produces { not: filter } structure", () => {
			fc.assert(
				fc.property(simpleFilterArb, (filterObj) => {
					const result = filter.not(filterObj)
					expect(result).toHaveProperty("not")
					expect(result.not).toEqual(filterObj)
				}),
				{ numRuns: 100 },
			)
		})

		it("nested logical operators preserve structure", () => {
			fc.assert(
				fc.property(simpleFilterArb, simpleFilterArb, simpleFilterArb, (f1, f2, f3) => {
					// Test: and(or(f1, f2), f3)
					const nested = filter.and(filter.or(f1, f2), f3)
					expect(nested).toHaveProperty("and")
					expect(nested.and).toHaveLength(2)
					expect(nested.and[0]).toHaveProperty("or")
					expect((nested.and[0] as { or: Filter[] }).or).toEqual([f1, f2])
					expect(nested.and[1]).toEqual(f3)
				}),
				{ numRuns: 100 },
			)
		})

		it("f alias logical operators work identically to filter", () => {
			fc.assert(
				fc.property(simpleFilterArb, simpleFilterArb, (f1, f2) => {
					expect(f.and(f1, f2)).toEqual(filter.and(f1, f2))
					expect(f.or(f1, f2)).toEqual(filter.or(f1, f2))
					expect(f.not(f1)).toEqual(filter.not(f1))
				}),
				{ numRuns: 100 },
			)
		})
	})

	/**
	 * Feature: qbjs-client-enhancement, Property 4: Null/Undefined Filters Excluded
	 * For any filter condition where the value is null or undefined,
	 * that condition SHALL NOT appear in the serialized output.
	 * **Validates: Requirements 1.5**
	 */
	describe("Property 4: Null/Undefined Filters Excluded", () => {
		it("buildQuery excludes undefined filter from output", () => {
			const result = buildQuery({ page: 1, filter: undefined })
			expect(result).not.toHaveProperty("filter")
		})

		it("buildQuery with no filter produces no filter key", () => {
			fc.assert(
				fc.property(
					fc.record({
						page: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
						limit: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
					}),
					(params) => {
						const result = buildQuery(params)
						// When filter is not provided, it should not appear in output
						if (params.page === undefined && params.limit === undefined) {
							expect(Object.keys(result)).toHaveLength(0)
						}
						expect(result).not.toHaveProperty("filter")
					},
				),
				{ numRuns: 100 },
			)
		})

		it("buildQuery with valid filter includes filter in output", () => {
			fc.assert(
				fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (field, value) => {
					const filterObj = { [field]: filter.eq(value) }
					const result = buildQuery({ filter: filterObj })
					expect(result).toHaveProperty("filter")
					expect(result.filter).toBe(JSON.stringify(filterObj))
				}),
				{ numRuns: 100 },
			)
		})
	})
})
