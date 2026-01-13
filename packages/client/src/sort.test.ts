/**
 * Property-based tests for sort builder functionality
 *
 * Feature: qbjs-client-enhancement
 * @module sort.test
 */

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import { query, serializeSort } from "./index"
import type { SortDirection, SortSpec } from "./types"

describe("Sort Builder", () => {
	const sortDirectionArb = fc.constantFrom<SortDirection>("asc", "desc")
	const fieldNameArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes(":") && !s.includes(","))

	/**
	 * Feature: qbjs-client-enhancement, Property 8: Sort Direction Support
	 * For any field name, both sortAsc() and sortDesc() SHALL produce sort specifications
	 * with "asc" and "desc" directions respectively.
	 * **Validates: Requirements 3.1**
	 */
	describe("Property 8: Sort Direction Support", () => {
		it("sortAsc() produces sort with 'asc' direction", () => {
			fc.assert(
				fc.property(fieldNameArb, (field) => {
					const builder = query().sortAsc(field)
					const params = builder.toParams()

					expect(params.sort).toBeDefined()
					expect(params.sort).toHaveLength(1)
					expect(params.sort[0].field).toBe(field)
					expect(params.sort[0].direction).toBe("asc")
				}),
				{ numRuns: 100 },
			)
		})

		it("sortDesc() produces sort with 'desc' direction", () => {
			fc.assert(
				fc.property(fieldNameArb, (field) => {
					const builder = query().sortDesc(field)
					const params = builder.toParams()

					expect(params.sort).toBeDefined()
					expect(params.sort).toHaveLength(1)
					expect(params.sort[0].field).toBe(field)
					expect(params.sort[0].direction).toBe("desc")
				}),
				{ numRuns: 100 },
			)
		})

		it("sort() with explicit direction uses that direction", () => {
			fc.assert(
				fc.property(fieldNameArb, sortDirectionArb, (field, direction) => {
					const builder = query().sort(field, direction)
					const params = builder.toParams()

					expect(params.sort).toBeDefined()
					expect(params.sort[0].direction).toBe(direction)
				}),
				{ numRuns: 100 },
			)
		})

		it("sort() without direction defaults to 'asc'", () => {
			fc.assert(
				fc.property(fieldNameArb, (field) => {
					const builder = query().sort(field)
					const params = builder.toParams()

					expect(params.sort).toBeDefined()
					expect(params.sort[0].direction).toBe("asc")
				}),
				{ numRuns: 100 },
			)
		})
	})

	/**
	 * Feature: qbjs-client-enhancement, Property 9: Sort Order Preservation
	 * For any sequence of sort method calls, the serialized sort string SHALL preserve
	 * the order in which sorts were added.
	 * **Validates: Requirements 3.2**
	 */
	describe("Property 9: Sort Order Preservation", () => {
		it("multiple sort calls preserve order", () => {
			fc.assert(
				fc.property(fc.array(fc.tuple(fieldNameArb, sortDirectionArb), { minLength: 1, maxLength: 5 }), (sortSpecs) => {
					let builder = query()
					for (const [field, direction] of sortSpecs) {
						builder = builder.sort(field, direction)
					}

					const params = builder.toParams()
					expect(params.sort).toHaveLength(sortSpecs.length)

					for (let i = 0; i < sortSpecs.length; i++) {
						expect(params.sort[i].field).toBe(sortSpecs[i][0])
						expect(params.sort[i].direction).toBe(sortSpecs[i][1])
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("serializeSort preserves order in output string", () => {
			fc.assert(
				fc.property(fc.array(fc.tuple(fieldNameArb, sortDirectionArb), { minLength: 2, maxLength: 5 }), (sortSpecs) => {
					const specs: SortSpec[] = sortSpecs.map(([field, direction]) => ({ field, direction }))
					const serialized = serializeSort(specs)
					const parts = serialized.split(",")

					expect(parts).toHaveLength(specs.length)
					for (let i = 0; i < specs.length; i++) {
						expect(parts[i]).toBe(`${specs[i].field}:${specs[i].direction}`)
					}
				}),
				{ numRuns: 100 },
			)
		})
	})

	/**
	 * Feature: qbjs-client-enhancement, Property 10: Sort Serialization Format
	 * For any array of sort specifications, the serialized output SHALL match
	 * the format "field1:dir1,field2:dir2".
	 * **Validates: Requirements 3.3**
	 */
	describe("Property 10: Sort Serialization Format", () => {
		it("single sort serializes to 'field:direction' format", () => {
			fc.assert(
				fc.property(fieldNameArb, sortDirectionArb, (field, direction) => {
					const specs: SortSpec[] = [{ field, direction }]
					const serialized = serializeSort(specs)

					expect(serialized).toBe(`${field}:${direction}`)
				}),
				{ numRuns: 100 },
			)
		})

		it("multiple sorts serialize to comma-separated format", () => {
			fc.assert(
				fc.property(fc.array(fc.tuple(fieldNameArb, sortDirectionArb), { minLength: 2, maxLength: 5 }), (sortSpecs) => {
					const specs: SortSpec[] = sortSpecs.map(([field, direction]) => ({ field, direction }))
					const serialized = serializeSort(specs)

					// Should contain commas separating each sort
					expect(serialized.split(",")).toHaveLength(specs.length)

					// Each part should be field:direction
					const parts = serialized.split(",")
					for (const part of parts) {
						expect(part).toMatch(/^.+:(asc|desc)$/)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("empty sort array serializes to empty string", () => {
			expect(serializeSort([])).toBe("")
		})

		it("QueryBuilder.build() produces correct sort format", () => {
			fc.assert(
				fc.property(fc.array(fc.tuple(fieldNameArb, sortDirectionArb), { minLength: 1, maxLength: 3 }), (sortSpecs) => {
					let builder = query()
					for (const [field, direction] of sortSpecs) {
						builder = builder.sort(field, direction)
					}

					const result = builder.build()
					const expected = sortSpecs.map(([f, d]) => `${f}:${d}`).join(",")

					expect(result.sort).toBe(expected)
				}),
				{ numRuns: 100 },
			)
		})
	})
})
