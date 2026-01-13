/**
 * Property-based tests for pagination helper functionality
 *
 * Feature: qbjs-client-enhancement
 * @module pagination.test
 */

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import { calculateOffset, nextPage, prevPage } from "./index"

describe("Pagination Helpers", () => {
	// Arbitrary for positive page numbers (1-indexed pagination)
	const pageNumberArb = fc.integer({ min: 1, max: 10000 })
	// Arbitrary for limit values
	const limitArb = fc.integer({ min: 1, max: 1000 })

	/**
	 * Feature: qbjs-client-enhancement, Property 19: Next Page Calculation
	 * For any current page number p, the next page SHALL equal p + 1.
	 * **Validates: Requirements 7.2**
	 */
	describe("Property 19: Next Page Calculation", () => {
		it("nextPage returns currentPage + 1", () => {
			fc.assert(
				fc.property(pageNumberArb, (currentPage) => {
					const result = nextPage(currentPage)
					expect(result).toBe(currentPage + 1)
				}),
				{ numRuns: 100 },
			)
		})
	})

	/**
	 * Feature: qbjs-client-enhancement, Property 20: Previous Page Calculation with Minimum
	 * For any current page number p, the previous page SHALL equal max(1, p - 1).
	 * **Validates: Requirements 7.3**
	 */
	describe("Property 20: Previous Page Calculation with Minimum", () => {
		it("prevPage returns max(1, currentPage - 1)", () => {
			fc.assert(
				fc.property(pageNumberArb, (currentPage) => {
					const result = prevPage(currentPage)
					expect(result).toBe(Math.max(1, currentPage - 1))
				}),
				{ numRuns: 100 },
			)
		})

		it("prevPage never returns less than 1", () => {
			fc.assert(
				fc.property(fc.integer({ min: -100, max: 100 }), (currentPage) => {
					const result = prevPage(currentPage)
					expect(result).toBeGreaterThanOrEqual(1)
				}),
				{ numRuns: 100 },
			)
		})

		it("prevPage(1) returns 1", () => {
			expect(prevPage(1)).toBe(1)
		})
	})

	/**
	 * Feature: qbjs-client-enhancement, Property 21: Offset Calculation
	 * For any page number p and limit l, the calculated offset SHALL equal (p - 1) * l.
	 * **Validates: Requirements 7.4**
	 */
	describe("Property 21: Offset Calculation", () => {
		it("calculateOffset returns (page - 1) * limit", () => {
			fc.assert(
				fc.property(pageNumberArb, limitArb, (page, limit) => {
					const result = calculateOffset(page, limit)
					expect(result).toBe((page - 1) * limit)
				}),
				{ numRuns: 100 },
			)
		})

		it("calculateOffset(1, limit) returns 0 for any limit", () => {
			fc.assert(
				fc.property(limitArb, (limit) => {
					const result = calculateOffset(1, limit)
					expect(result).toBe(0)
				}),
				{ numRuns: 100 },
			)
		})
	})
})
