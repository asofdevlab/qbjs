/**
 * Property-based tests for query key generation functionality
 *
 * Feature: qbjs-client-enhancement
 * @module query-key.test
 */

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import { createQueryKey, query } from "./index"
import type { Filter, QueryParams, SortDirection, SortSpec } from "./types"

describe("Query Key Generation", () => {
	// Arbitraries for generating test data
	const sortDirectionArb = fc.constantFrom<SortDirection>("asc", "desc")
	const fieldNameArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s))

	const sortSpecArb: fc.Arbitrary<SortSpec> = fc.record({
		field: fieldNameArb,
		direction: sortDirectionArb,
	})

	const queryParamsArb: fc.Arbitrary<QueryParams> = fc.record(
		{
			page: fc.integer({ min: 1, max: 1000 }),
			limit: fc.integer({ min: 1, max: 100 }),
			sort: fc.array(sortSpecArb, { minLength: 0, maxLength: 3 }),
			fields: fc.array(fieldNameArb, { minLength: 0, maxLength: 5 }),
		},
		{ requiredKeys: [] },
	)

	const prefixArb = fc.array(
		fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
		{
			minLength: 0,
			maxLength: 3,
		},
	)

	/**
	 * Feature: qbjs-client-enhancement, Property 22: Query Key Determinism
	 * For any QueryParams object, calling toQueryKey() multiple times SHALL produce identical results.
	 * **Validates: Requirements 9.1, 9.2**
	 */
	describe("Property 22: Query Key Determinism", () => {
		it("createQueryKey produces identical results for same inputs", () => {
			fc.assert(
				fc.property(prefixArb, queryParamsArb, (prefix, params) => {
					const key1 = createQueryKey(prefix, params)
					const key2 = createQueryKey(prefix, params)

					// Convert to JSON strings for deep comparison
					expect(JSON.stringify(key1)).toBe(JSON.stringify(key2))
				}),
				{ numRuns: 100 },
			)
		})

		it("QueryBuilder.toQueryKey produces identical results for same state", () => {
			fc.assert(
				fc.property(
					prefixArb,
					fc.integer({ min: 1, max: 100 }),
					fc.integer({ min: 1, max: 50 }),
					(prefix, page, limit) => {
						const builder = query().page(page).limit(limit)

						const key1 = builder.toQueryKey(prefix)
						const key2 = builder.toQueryKey(prefix)

						expect(JSON.stringify(key1)).toBe(JSON.stringify(key2))
					},
				),
				{ numRuns: 100 },
			)
		})

		it("same params with different key order produce identical query keys", () => {
			fc.assert(
				fc.property(
					fc.integer({ min: 1, max: 100 }),
					fc.integer({ min: 1, max: 50 }),
					fc.array(fieldNameArb, { minLength: 1, maxLength: 3 }),
					(page, limit, fields) => {
						// Create params with keys in different orders
						const params1: QueryParams = { page, limit, fields }
						const params2: QueryParams = { fields, limit, page }

						const key1 = createQueryKey(["test"], params1)
						const key2 = createQueryKey(["test"], params2)

						expect(JSON.stringify(key1)).toBe(JSON.stringify(key2))
					},
				),
				{ numRuns: 100 },
			)
		})
	})

	/**
	 * Feature: qbjs-client-enhancement, Property 23: Query Key JSON-Serializable
	 * For any QueryParams object, the query key produced by toQueryKey() SHALL be JSON-serializable without throwing.
	 * **Validates: Requirements 9.3**
	 */
	describe("Property 23: Query Key JSON-Serializable", () => {
		it("createQueryKey output is JSON-serializable", () => {
			fc.assert(
				fc.property(prefixArb, queryParamsArb, (prefix, params) => {
					const key = createQueryKey(prefix, params)

					// Should not throw when serializing
					expect(() => JSON.stringify(key)).not.toThrow()

					// Should produce valid JSON
					const serialized = JSON.stringify(key)
					expect(() => JSON.parse(serialized)).not.toThrow()
				}),
				{ numRuns: 100 },
			)
		})

		it("QueryBuilder.toQueryKey output is JSON-serializable", () => {
			fc.assert(
				fc.property(
					prefixArb,
					fc.integer({ min: 1, max: 100 }),
					fc.integer({ min: 1, max: 50 }),
					sortSpecArb,
					(prefix, page, limit, sortSpec) => {
						const builder = query().page(page).limit(limit).sort(sortSpec.field, sortSpec.direction)

						const key = builder.toQueryKey(prefix)

						// Should not throw when serializing
						expect(() => JSON.stringify(key)).not.toThrow()

						// Should produce valid JSON
						const serialized = JSON.stringify(key)
						expect(() => JSON.parse(serialized)).not.toThrow()
					},
				),
				{ numRuns: 100 },
			)
		})

		it("empty params produce JSON-serializable key", () => {
			const key = createQueryKey(["test"])
			expect(() => JSON.stringify(key)).not.toThrow()
			expect(key).toEqual(["test"])
		})

		it("complex nested filters produce JSON-serializable key", () => {
			const complexFilter: Filter = {
				and: [{ status: { eq: "active" } }, { or: [{ role: { eq: "admin" } }, { role: { eq: "moderator" } }] }],
			}

			const params: QueryParams = {
				page: 1,
				limit: 10,
				filter: complexFilter,
			}

			const key = createQueryKey(["users"], params)
			expect(() => JSON.stringify(key)).not.toThrow()
		})
	})
})
