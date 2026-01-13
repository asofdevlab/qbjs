/**
 * Property-based tests for QueryBuilder class
 *
 * Feature: qbjs-client-enhancement
 * @module builder.test
 */

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import { filter, QueryBuilder, query } from "./index"
import type { Filter, SortDirection } from "./types"

describe("QueryBuilder", () => {
	/**
	 * Feature: qbjs-client-enhancement, Property 5: Build Returns Record of Strings
	 * For any query builder state, calling build() SHALL return an object
	 * where all keys are strings and all values are strings.
	 * **Validates: Requirements 2.2**
	 */
	describe("Property 5: Build Returns Record of Strings", () => {
		const sortDirectionArb = fc.constantFrom<SortDirection>("asc", "desc")

		const sortSpecArb = fc.record({
			field: fc.string({ minLength: 1 }),
			direction: sortDirectionArb,
		})

		const simpleFilterArb = fc.string({ minLength: 1 }).map((field) => ({
			[field]: filter.eq("test"),
		})) as fc.Arbitrary<Filter>

		const queryParamsArb = fc.record({
			page: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
			limit: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
			sort: fc.option(fc.array(sortSpecArb, { maxLength: 3 }), { nil: undefined }),
			fields: fc.option(fc.array(fc.string({ minLength: 1 }), { maxLength: 5 }), { nil: undefined }),
			filter: fc.option(simpleFilterArb, { nil: undefined }),
		})

		it("build() returns object with all string keys and string values", () => {
			fc.assert(
				fc.property(queryParamsArb, (params) => {
					const builder = new QueryBuilder(params)
					const result = builder.build()

					// All keys should be strings
					for (const key of Object.keys(result)) {
						expect(typeof key).toBe("string")
					}

					// All values should be strings
					for (const value of Object.values(result)) {
						expect(typeof value).toBe("string")
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("empty builder produces empty object", () => {
			const builder = query()
			const result = builder.build()
			expect(result).toEqual({})
		})
	})

	/**
	 * Feature: qbjs-client-enhancement, Property 6: Method Chaining Order Independence
	 * For any set of query builder method calls (page, limit, sort, fields, filter),
	 * the final build() output SHALL be identical regardless of the order in which methods were called.
	 * **Validates: Requirements 2.3**
	 */
	describe("Property 6: Method Chaining Order Independence", () => {
		it("page and limit order does not affect result", () => {
			fc.assert(
				fc.property(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 1, max: 100 }), (page, limit) => {
					const result1 = query().page(page).limit(limit).build()
					const result2 = query().limit(limit).page(page).build()
					expect(result1).toEqual(result2)
				}),
				{ numRuns: 100 },
			)
		})

		it("pagination and fields order does not affect result", () => {
			fc.assert(
				fc.property(
					fc.integer({ min: 1, max: 100 }),
					fc.integer({ min: 1, max: 100 }),
					fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }),
					(page, limit, fields) => {
						const result1 = query()
							.page(page)
							.limit(limit)
							.fields(...fields)
							.build()
						const result2 = query()
							.fields(...fields)
							.page(page)
							.limit(limit)
							.build()
						expect(result1).toEqual(result2)
					},
				),
				{ numRuns: 100 },
			)
		})

		it("filter and pagination order does not affect result", () => {
			fc.assert(
				fc.property(
					fc.integer({ min: 1, max: 100 }),
					fc.string({ minLength: 1 }),
					fc.string({ minLength: 1 }),
					(page, field, value) => {
						const filterObj = { [field]: filter.eq(value) }
						const result1 = query().page(page).filter(filterObj).build()
						const result2 = query().filter(filterObj).page(page).build()
						expect(result1).toEqual(result2)
					},
				),
				{ numRuns: 100 },
			)
		})
	})

	/**
	 * Feature: qbjs-client-enhancement, Property 7: Builder Immutability
	 * For any query builder instance, calling any chainable method SHALL return
	 * a new instance without modifying the original instance's state.
	 * **Validates: Requirements 2.5**
	 */
	describe("Property 7: Builder Immutability", () => {
		it("page() returns new instance without modifying original", () => {
			fc.assert(
				fc.property(fc.integer({ min: 1, max: 100 }), (page) => {
					const original = query()
					const originalParams = original.toParams()
					const modified = original.page(page)

					// Original should be unchanged
					expect(original.toParams()).toEqual(originalParams)
					// Modified should be different instance
					expect(modified).not.toBe(original)
					// Modified should have the new page
					expect(modified.toParams().page).toBe(page)
				}),
				{ numRuns: 100 },
			)
		})

		it("limit() returns new instance without modifying original", () => {
			fc.assert(
				fc.property(fc.integer({ min: 1, max: 100 }), (limit) => {
					const original = query().page(1)
					const originalParams = original.toParams()
					const modified = original.limit(limit)

					expect(original.toParams()).toEqual(originalParams)
					expect(modified).not.toBe(original)
					expect(modified.toParams().limit).toBe(limit)
				}),
				{ numRuns: 100 },
			)
		})

		it("sort() returns new instance without modifying original", () => {
			fc.assert(
				fc.property(fc.string({ minLength: 1 }), (field) => {
					const original = query()
					const originalParams = original.toParams()
					const modified = original.sort(field, "asc")

					expect(original.toParams()).toEqual(originalParams)
					expect(modified).not.toBe(original)
					expect(modified.toParams().sort).toHaveLength(1)
				}),
				{ numRuns: 100 },
			)
		})

		it("fields() returns new instance without modifying original", () => {
			fc.assert(
				fc.property(fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }), (fields) => {
					const original = query()
					const originalParams = original.toParams()
					const modified = original.fields(...fields)

					expect(original.toParams()).toEqual(originalParams)
					expect(modified).not.toBe(original)
					expect(modified.toParams().fields).toBeDefined()
				}),
				{ numRuns: 100 },
			)
		})

		it("filter() returns new instance without modifying original", () => {
			fc.assert(
				fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (field, value) => {
					const original = query()
					const originalParams = original.toParams()
					const filterObj = { [field]: filter.eq(value) }
					const modified = original.filter(filterObj)

					expect(original.toParams()).toEqual(originalParams)
					expect(modified).not.toBe(original)
					expect(modified.toParams().filter).toBeDefined()
				}),
				{ numRuns: 100 },
			)
		})

		it("chained operations do not affect intermediate builders", () => {
			fc.assert(
				fc.property(
					fc.integer({ min: 1, max: 100 }),
					fc.integer({ min: 1, max: 100 }),
					fc.string({ minLength: 1 }),
					(page, limit, field) => {
						const step1 = query().page(page)
						const step1Params = step1.toParams()

						const step2 = step1.limit(limit)
						const step2Params = step2.toParams()

						const step3 = step2.sort(field, "desc")

						// step1 should still only have page
						expect(step1.toParams()).toEqual(step1Params)
						expect(step1.toParams().limit).toBeUndefined()

						// step2 should have page and limit but no sort
						expect(step2.toParams()).toEqual(step2Params)
						expect(step2.toParams().sort).toBeUndefined()

						// step3 should have all three
						expect(step3.toParams().page).toBe(page)
						expect(step3.toParams().limit).toBe(limit)
						expect(step3.toParams().sort).toHaveLength(1)
					},
				),
				{ numRuns: 100 },
			)
		})
	})
})
