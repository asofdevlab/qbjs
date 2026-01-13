/**
 * Property-based tests for Search Query functionality
 *
 * Feature: qbjs-client-enhancement
 * @module search.test
 */

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import { buildSearchQuery, filter } from "./index"
import type { Filter, SearchQueryParams, SortDirection } from "./types"

describe("Search Query", () => {
	/**
	 * Feature: qbjs-client-enhancement, Property 17: Search Query Includes Q Parameter
	 * For any search query built with buildSearchQuery, the output SHALL contain
	 * a 'q' key with the search term value.
	 * **Validates: Requirements 6.2**
	 */
	describe("Property 17: Search Query Includes Q Parameter", () => {
		it("buildSearchQuery always includes q parameter with the search term", () => {
			fc.assert(
				fc.property(fc.string({ minLength: 1 }), (searchTerm) => {
					const result = buildSearchQuery({ q: searchTerm })

					// The 'q' key must exist
					expect(result).toHaveProperty("q")
					// The 'q' value must match the input search term
					expect(result.q).toBe(searchTerm)
				}),
				{ numRuns: 100 },
			)
		})

		it("q parameter is preserved even with empty string", () => {
			const result = buildSearchQuery({ q: "" })
			expect(result).toHaveProperty("q")
			expect(result.q).toBe("")
		})

		it("q parameter handles special characters", () => {
			fc.assert(
				fc.property(
					fc.string({ minLength: 1 }).map((s) => `${s} & = ? # ${s}`),
					(searchTerm) => {
						const result = buildSearchQuery({ q: searchTerm })
						expect(result.q).toBe(searchTerm)
					},
				),
				{ numRuns: 100 },
			)
		})
	})

	/**
	 * Feature: qbjs-client-enhancement, Property 18: Search Combines with Other Params
	 * For any search query with pagination, sorting, and filtering,
	 * all parameters SHALL be present in the serialized output.
	 * **Validates: Requirements 6.3**
	 */
	describe("Property 18: Search Combines with Other Params", () => {
		const sortDirectionArb = fc.constantFrom<SortDirection>("asc", "desc")

		const sortSpecArb = fc.record({
			field: fc.string({ minLength: 1, maxLength: 20 }),
			direction: sortDirectionArb,
		})

		const simpleFilterArb = fc.string({ minLength: 1, maxLength: 20 }).map((field) => ({
			[field]: filter.eq("test"),
		})) as fc.Arbitrary<Filter>

		const searchQueryParamsArb = fc.record({
			q: fc.string({ minLength: 1, maxLength: 50 }),
			page: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
			limit: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
			sort: fc.option(fc.array(sortSpecArb, { minLength: 1, maxLength: 3 }), { nil: undefined }),
			fields: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }), {
				nil: undefined,
			}),
			filter: fc.option(simpleFilterArb, { nil: undefined }),
		}) as fc.Arbitrary<SearchQueryParams>

		it("search query includes q along with pagination parameters", () => {
			fc.assert(
				fc.property(
					fc.string({ minLength: 1 }),
					fc.integer({ min: 1, max: 100 }),
					fc.integer({ min: 1, max: 100 }),
					(searchTerm, page, limit) => {
						const result = buildSearchQuery({ q: searchTerm, page, limit })

						// q must be present
						expect(result.q).toBe(searchTerm)
						// pagination must be present
						expect(result.page).toBe(String(page))
						expect(result.limit).toBe(String(limit))
					},
				),
				{ numRuns: 100 },
			)
		})

		it("search query includes q along with sort parameters", () => {
			fc.assert(
				fc.property(
					fc.string({ minLength: 1 }),
					fc.array(sortSpecArb, { minLength: 1, maxLength: 3 }),
					(searchTerm, sort) => {
						const result = buildSearchQuery({ q: searchTerm, sort })

						// q must be present
						expect(result.q).toBe(searchTerm)
						// sort must be present
						expect(result.sort).toBeDefined()
						// sort should contain all fields
						for (const s of sort) {
							expect(result.sort).toContain(s.field)
						}
					},
				),
				{ numRuns: 100 },
			)
		})

		it("search query includes q along with fields parameters", () => {
			// Use alphanumeric field names to avoid comma issues in serialization
			const fieldNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]*$/).filter((s) => s.length > 0 && s.length <= 20)

			fc.assert(
				fc.property(
					fc.string({ minLength: 1 }),
					fc.array(fieldNameArb, { minLength: 1, maxLength: 5 }),
					(searchTerm, fields) => {
						const result = buildSearchQuery({ q: searchTerm, fields })

						// q must be present
						expect(result.q).toBe(searchTerm)
						// fields must be present
						expect(result.fields).toBeDefined()
						// fields should be comma-separated
						const resultFields = result.fields?.split(",") || []
						// All unique input fields should be in output
						const uniqueFields = [...new Set(fields)]
						for (const field of uniqueFields) {
							expect(resultFields).toContain(field)
						}
					},
				),
				{ numRuns: 100 },
			)
		})

		it("search query includes q along with filter parameters", () => {
			fc.assert(
				fc.property(fc.string({ minLength: 1 }), simpleFilterArb, (searchTerm, filterObj) => {
					const result = buildSearchQuery({ q: searchTerm, filter: filterObj })

					// q must be present
					expect(result.q).toBe(searchTerm)
					// filter must be present
					expect(result.filter).toBeDefined()
				}),
				{ numRuns: 100 },
			)
		})

		it("search query combines all parameters together", () => {
			fc.assert(
				fc.property(searchQueryParamsArb, (params) => {
					const result = buildSearchQuery(params)

					// q must always be present
					expect(result.q).toBe(params.q)

					// Other params should be present if defined
					if (params.page !== undefined) {
						expect(result.page).toBe(String(params.page))
					}
					if (params.limit !== undefined) {
						expect(result.limit).toBe(String(params.limit))
					}
					if (params.sort && params.sort.length > 0) {
						expect(result.sort).toBeDefined()
					}
					if (params.fields && params.fields.length > 0) {
						expect(result.fields).toBeDefined()
					}
					if (params.filter) {
						expect(result.filter).toBeDefined()
					}
				}),
				{ numRuns: 100 },
			)
		})
	})
})
