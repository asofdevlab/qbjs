/**
 * Integration tests for @qbjs/client with @qbjs/core
 *
 * These tests verify that queries built with @qbjs/client can be
 * correctly parsed by @qbjs/core's parser.
 *
 * Feature: qbjs-client-enhancement
 * @module integration.test
 */

import { parseQueryString } from "@qbjs/core"
import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import { f, query, toQueryString } from "./index"
import type { Filter, QueryParams, SortDirection, SortSpec } from "./types"

describe("Integration with @qbjs/core", () => {
	// Arbitraries for generating test data
	const sortDirectionArb = fc.constantFrom<SortDirection>("asc", "desc")

	// Reserved JavaScript property names that should be excluded (security)
	const reservedNames = new Set([
		"toString",
		"valueOf",
		"hasOwnProperty",
		"isPrototypeOf",
		"propertyIsEnumerable",
		"toLocaleString",
		"constructor",
		"__proto__",
		"__defineGetter__",
		"__defineSetter__",
		"__lookupGetter__",
		"__lookupSetter__",
	])

	// Field names that are safe for URL encoding and not reserved
	const safeFieldNameArb = fc
		.string({ minLength: 1, maxLength: 20 })
		.filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s) && !reservedNames.has(s))

	const sortSpecArb: fc.Arbitrary<SortSpec> = fc.record({
		field: safeFieldNameArb,
		direction: sortDirectionArb,
	})

	// Simple filter values that are safe for serialization
	const simpleStringValueArb = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[a-zA-Z0-9_\- ]+$/.test(s))

	const simpleNumberValueArb = fc.integer({ min: -10000, max: 10000 })

	/**
	 * Feature: qbjs-client-enhancement, Property 16: Serialization Round-Trip with @qbjs/core
	 * For any valid QueryParams object, serializing to a query string and then parsing
	 * with @qbjs/core's parseQueryString SHALL produce an equivalent AST representation.
	 * **Validates: Requirements 5.4, 5.2**
	 */
	describe("Property 16: Serialization Round-Trip with @qbjs/core", () => {
		it("pagination params round-trip correctly", () => {
			fc.assert(
				fc.property(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 1, max: 100 }), (page, limit) => {
					const params: QueryParams = { page, limit }
					const queryString = toQueryString(params)
					const result = parseQueryString(queryString)

					expect(result.errors).toHaveLength(0)
					expect(result.ast).not.toBeNull()
					expect(result.ast?.pagination.offset).toBe((page - 1) * limit)
					expect(result.ast?.pagination.limit).toBe(limit)
				}),
				{ numRuns: 100 },
			)
		})

		it("sort params round-trip correctly", () => {
			fc.assert(
				fc.property(fc.array(sortSpecArb, { minLength: 1, maxLength: 3 }), (sort) => {
					const params: QueryParams = { sort }
					const queryString = toQueryString(params)
					const result = parseQueryString(queryString)

					expect(result.errors).toHaveLength(0)
					expect(result.ast).not.toBeNull()
					expect(result.ast?.sort).toHaveLength(sort.length)

					for (let i = 0; i < sort.length; i++) {
						expect(result.ast?.sort[i].field).toBe(sort[i].field)
						expect(result.ast?.sort[i].direction).toBe(sort[i].direction)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("fields params round-trip correctly", () => {
			fc.assert(
				fc.property(fc.array(safeFieldNameArb, { minLength: 1, maxLength: 5 }), (fields) => {
					// Deduplicate fields as the client does
					const uniqueFields = [...new Set(fields)]
					const params: QueryParams = { fields: uniqueFields }
					const queryString = toQueryString(params)
					const result = parseQueryString(queryString)

					expect(result.errors).toHaveLength(0)
					expect(result.ast).not.toBeNull()
					expect(result.ast?.fields).toEqual(uniqueFields)
				}),
				{ numRuns: 100 },
			)
		})

		it("simple eq filter round-trips correctly", () => {
			fc.assert(
				fc.property(safeFieldNameArb, simpleStringValueArb, (field, value) => {
					const filter: Filter = { [field]: { eq: value } }
					const params: QueryParams = { filter }
					const queryString = toQueryString(params)
					const result = parseQueryString(queryString)

					expect(result.errors).toHaveLength(0)
					expect(result.ast).not.toBeNull()
					expect(result.ast?.filter).not.toBeNull()

					// The filter should be a field filter with eq operator
					const parsedFilter = result.ast?.filter
					if (parsedFilter?.type === "field") {
						expect(parsedFilter.field).toBe(field)
						expect(parsedFilter.operator).toBe("eq")
						expect(parsedFilter.value).toBe(value)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("numeric filter values round-trip correctly", () => {
			fc.assert(
				fc.property(safeFieldNameArb, simpleNumberValueArb, (field, value) => {
					const filter: Filter = { [field]: { gt: value } }
					const params: QueryParams = { filter }
					const queryString = toQueryString(params)
					const result = parseQueryString(queryString)

					expect(result.errors).toHaveLength(0)
					expect(result.ast).not.toBeNull()
					expect(result.ast?.filter).not.toBeNull()

					const parsedFilter = result.ast?.filter
					if (parsedFilter?.type === "field") {
						expect(parsedFilter.field).toBe(field)
						expect(parsedFilter.operator).toBe("gt")
						// Value may be parsed as string, so compare as strings
						expect(String(parsedFilter.value)).toBe(String(value))
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("complete query params round-trip correctly", () => {
			fc.assert(
				fc.property(
					fc.integer({ min: 1, max: 50 }),
					fc.integer({ min: 1, max: 50 }),
					fc.array(sortSpecArb, { minLength: 1, maxLength: 2 }),
					fc.array(safeFieldNameArb, { minLength: 1, maxLength: 3 }),
					safeFieldNameArb,
					simpleStringValueArb,
					(page, limit, sort, fields, filterField, filterValue) => {
						const uniqueFields = [...new Set(fields)]
						const params: QueryParams = {
							page,
							limit,
							sort,
							fields: uniqueFields,
							filter: { [filterField]: { eq: filterValue } },
						}

						const queryString = toQueryString(params)
						const result = parseQueryString(queryString)

						expect(result.errors).toHaveLength(0)
						expect(result.ast).not.toBeNull()

						// Verify pagination
						expect(result.ast?.pagination.offset).toBe((page - 1) * limit)
						expect(result.ast?.pagination.limit).toBe(limit)

						// Verify sort
						expect(result.ast?.sort).toHaveLength(sort.length)

						// Verify fields
						expect(result.ast?.fields).toEqual(uniqueFields)

						// Verify filter exists
						expect(result.ast?.filter).not.toBeNull()
					},
				),
				{ numRuns: 100 },
			)
		})

		it("QueryBuilder produces parseable output", () => {
			fc.assert(
				fc.property(
					fc.integer({ min: 1, max: 50 }),
					fc.integer({ min: 1, max: 50 }),
					safeFieldNameArb,
					sortDirectionArb,
					(page, limit, sortField, sortDir) => {
						const builder = query().page(page).limit(limit).sort(sortField, sortDir)

						const queryString = builder.toQueryString()
						const result = parseQueryString(queryString)

						expect(result.errors).toHaveLength(0)
						expect(result.ast).not.toBeNull()
						expect(result.ast?.pagination.offset).toBe((page - 1) * limit)
						expect(result.ast?.pagination.limit).toBe(limit)
						expect(result.ast?.sort).toHaveLength(1)
						expect(result.ast?.sort[0].field).toBe(sortField)
						expect(result.ast?.sort[0].direction).toBe(sortDir)
					},
				),
				{ numRuns: 100 },
			)
		})

		it("filter helpers produce parseable output", () => {
			const filter: Filter = { status: f.eq("active") }
			const params: QueryParams = { filter }
			const queryString = toQueryString(params)
			const result = parseQueryString(queryString)

			expect(result.errors).toHaveLength(0)
			expect(result.ast?.filter).not.toBeNull()
		})

		it("logical AND filter round-trips correctly", () => {
			const filter: Filter = f.and({ status: f.eq("active") }, { role: f.eq("admin") })
			const params: QueryParams = { filter }
			const queryString = toQueryString(params)
			const result = parseQueryString(queryString)

			expect(result.errors).toHaveLength(0)
			expect(result.ast?.filter).not.toBeNull()
			expect(result.ast?.filter?.type).toBe("logical")
			if (result.ast?.filter?.type === "logical") {
				expect(result.ast.filter.operator).toBe("and")
				expect(result.ast.filter.conditions).toHaveLength(2)
			}
		})

		it("logical OR filter round-trips correctly", () => {
			const filter: Filter = f.or({ status: f.eq("draft") }, { status: f.eq("pending") })
			const params: QueryParams = { filter }
			const queryString = toQueryString(params)
			const result = parseQueryString(queryString)

			expect(result.errors).toHaveLength(0)
			expect(result.ast?.filter).not.toBeNull()
			expect(result.ast?.filter?.type).toBe("logical")
			if (result.ast?.filter?.type === "logical") {
				expect(result.ast.filter.operator).toBe("or")
				expect(result.ast.filter.conditions).toHaveLength(2)
			}
		})
	})
})
