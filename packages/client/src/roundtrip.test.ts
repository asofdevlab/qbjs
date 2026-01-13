/**
 * Property-based tests for print/parse round-trip functionality
 *
 * Feature: qbjs-client-enhancement
 * @module roundtrip.test
 */

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import { parseQuery, printQuery } from "./index"
import type { Filter, QueryParams, SortDirection, SortSpec } from "./types"

describe("Print/Parse Round-Trip", () => {
	// Arbitraries for generating test data
	const sortDirectionArb = fc.constantFrom<SortDirection>("asc", "desc")

	// Field names that are safe for URL encoding (no special chars that could break parsing)
	const safeFieldNameArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s))

	const sortSpecArb: fc.Arbitrary<SortSpec> = fc.record({
		field: safeFieldNameArb,
		direction: sortDirectionArb,
	})

	// Simple filter values that are JSON-safe
	const simpleValueArb = fc.oneof(
		fc.string().filter((s) => s.length < 50),
		fc.integer({ min: -10000, max: 10000 }),
		fc.boolean(),
	)

	// Simple field filter (single field with single operator)
	const simpleFieldFilterArb: fc.Arbitrary<Filter> = fc
		.tuple(safeFieldNameArb, simpleValueArb)
		.map(([field, value]) => ({ [field]: { eq: value } }))

	// QueryParams without filter (simpler case)
	const queryParamsWithoutFilterArb: fc.Arbitrary<QueryParams> = fc.record(
		{
			page: fc.integer({ min: 1, max: 1000 }),
			limit: fc.integer({ min: 1, max: 100 }),
			sort: fc.array(sortSpecArb, { minLength: 1, maxLength: 3 }),
			fields: fc.array(safeFieldNameArb, { minLength: 1, maxLength: 5 }),
		},
		{ requiredKeys: [] },
	)

	// Full QueryParams with optional filter
	const queryParamsArb: fc.Arbitrary<QueryParams> = fc.record(
		{
			page: fc.integer({ min: 1, max: 1000 }),
			limit: fc.integer({ min: 1, max: 100 }),
			sort: fc.array(sortSpecArb, { minLength: 1, maxLength: 3 }),
			fields: fc.array(safeFieldNameArb, { minLength: 1, maxLength: 5 }),
			filter: simpleFieldFilterArb,
		},
		{ requiredKeys: [] },
	)

	/**
	 * Feature: qbjs-client-enhancement, Property 24: Print/Parse Round-Trip
	 * For any valid QueryParams object, printing to a query string and then parsing back
	 * SHALL produce an equivalent QueryParams object.
	 * **Validates: Requirements 10.3**
	 */
	describe("Property 24: Print/Parse Round-Trip", () => {
		it("round-trip preserves pagination params", () => {
			fc.assert(
				fc.property(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 1, max: 100 }), (page, limit) => {
					const original: QueryParams = { page, limit }
					const printed = printQuery(original)
					const parsed = parseQuery(printed)

					expect(parsed.page).toBe(original.page)
					expect(parsed.limit).toBe(original.limit)
				}),
				{ numRuns: 100 },
			)
		})

		it("round-trip preserves sort params", () => {
			fc.assert(
				fc.property(fc.array(sortSpecArb, { minLength: 1, maxLength: 3 }), (sort) => {
					const original: QueryParams = { sort }
					const printed = printQuery(original)
					const parsed = parseQuery(printed)

					expect(parsed.sort).toHaveLength(sort.length)
					for (let i = 0; i < sort.length; i++) {
						expect(parsed.sort?.[i].field).toBe(sort[i].field)
						expect(parsed.sort?.[i].direction).toBe(sort[i].direction)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("round-trip preserves fields params", () => {
			fc.assert(
				fc.property(fc.array(safeFieldNameArb, { minLength: 1, maxLength: 5 }), (fields) => {
					const original: QueryParams = { fields }
					const printed = printQuery(original)
					const parsed = parseQuery(printed)

					expect(parsed.fields).toEqual(fields)
				}),
				{ numRuns: 100 },
			)
		})

		it("round-trip preserves filter params", () => {
			fc.assert(
				fc.property(simpleFieldFilterArb, (filter) => {
					const original: QueryParams = { filter }
					const printed = printQuery(original)
					const parsed = parseQuery(printed)

					expect(parsed.filter).toEqual(filter)
				}),
				{ numRuns: 100 },
			)
		})

		it("round-trip preserves complete QueryParams without filter", () => {
			fc.assert(
				fc.property(queryParamsWithoutFilterArb, (original) => {
					// Skip empty params
					if (Object.keys(original).length === 0) return

					const printed = printQuery(original)
					const parsed = parseQuery(printed)

					if (original.page !== undefined) {
						expect(parsed.page).toBe(original.page)
					}
					if (original.limit !== undefined) {
						expect(parsed.limit).toBe(original.limit)
					}
					if (original.sort && original.sort.length > 0) {
						expect(parsed.sort).toHaveLength(original.sort.length)
					}
					if (original.fields && original.fields.length > 0) {
						expect(parsed.fields).toEqual(original.fields)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("round-trip preserves complete QueryParams with filter", () => {
			fc.assert(
				fc.property(queryParamsArb, (original) => {
					// Skip empty params
					if (Object.keys(original).length === 0) return

					const printed = printQuery(original)
					const parsed = parseQuery(printed)

					if (original.page !== undefined) {
						expect(parsed.page).toBe(original.page)
					}
					if (original.limit !== undefined) {
						expect(parsed.limit).toBe(original.limit)
					}
					if (original.sort && original.sort.length > 0) {
						expect(parsed.sort).toHaveLength(original.sort.length)
					}
					if (original.fields && original.fields.length > 0) {
						expect(parsed.fields).toEqual(original.fields)
					}
					if (original.filter) {
						expect(parsed.filter).toEqual(original.filter)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("empty params round-trip to empty object", () => {
			const original: QueryParams = {}
			const printed = printQuery(original)
			const parsed = parseQuery(printed)

			expect(printed).toBe("")
			expect(parsed).toEqual({})
		})

		it("parseQuery handles leading question mark", () => {
			const original: QueryParams = { page: 1, limit: 10 }
			const printed = printQuery(original)
			const parsedWithoutQ = parseQuery(printed)
			const parsedWithQ = parseQuery(`?${printed}`)

			expect(parsedWithoutQ).toEqual(parsedWithQ)
		})
	})
})
