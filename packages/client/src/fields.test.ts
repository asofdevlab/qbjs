/**
 * Property-based tests for field selection functionality
 *
 * Feature: qbjs-client-enhancement
 * @module fields.test
 */

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import { query, serializeFields } from "./index"

describe("Field Selection", () => {
	const fieldNameArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes(","))

	/**
	 * Feature: qbjs-client-enhancement, Property 11: Field Input Flexibility
	 * For any set of field names provided as an array, the output SHALL be equivalent
	 * to providing them as individual arguments to fields().
	 * **Validates: Requirements 4.1**
	 */
	describe("Property 11: Field Input Flexibility", () => {
		it("fields() accepts variadic arguments", () => {
			fc.assert(
				fc.property(fc.array(fieldNameArb, { minLength: 1, maxLength: 5 }), (fields) => {
					const builder = query().fields(...fields)
					const params = builder.toParams()

					expect(params.fields).toBeDefined()
					// All provided fields should be present (deduped)
					const uniqueFields = [...new Set(fields)]
					expect(params.fields).toHaveLength(uniqueFields.length)
				}),
				{ numRuns: 100 },
			)
		})

		it("multiple fields() calls accumulate fields", () => {
			fc.assert(
				fc.property(fieldNameArb, fieldNameArb, (field1, field2) => {
					const builder = query().fields(field1).fields(field2)
					const params = builder.toParams()

					expect(params.fields).toBeDefined()
					expect(params.fields).toContain(field1)
					expect(params.fields).toContain(field2)
				}),
				{ numRuns: 100 },
			)
		})

		it("select() is an alias for fields()", () => {
			fc.assert(
				fc.property(fc.array(fieldNameArb, { minLength: 1, maxLength: 5 }), (fields) => {
					const result1 = query()
						.fields(...fields)
						.toParams()
					const result2 = query()
						.select(...fields)
						.toParams()

					expect(result1.fields).toEqual(result2.fields)
				}),
				{ numRuns: 100 },
			)
		})
	})

	/**
	 * Feature: qbjs-client-enhancement, Property 12: Field Serialization Format
	 * For any array of field names, the serialized fields parameter SHALL be
	 * a comma-separated string of those names.
	 * **Validates: Requirements 4.2**
	 */
	describe("Property 12: Field Serialization Format", () => {
		it("serializeFields produces comma-separated string", () => {
			fc.assert(
				fc.property(fc.array(fieldNameArb, { minLength: 1, maxLength: 5 }), (fields) => {
					const uniqueFields = [...new Set(fields)]
					const serialized = serializeFields(fields)

					// Should be comma-separated
					const parts = serialized.split(",")
					expect(parts).toHaveLength(uniqueFields.length)

					// Each unique field should appear exactly once
					for (const field of uniqueFields) {
						expect(parts).toContain(field)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("QueryBuilder.build() produces correct fields format", () => {
			fc.assert(
				fc.property(fc.array(fieldNameArb, { minLength: 1, maxLength: 5 }), (fields) => {
					const builder = query().fields(...fields)
					const result = builder.build()

					expect(result.fields).toBeDefined()
					// Should be comma-separated
					expect(typeof result.fields).toBe("string")
				}),
				{ numRuns: 100 },
			)
		})

		it("empty fields array serializes to empty string", () => {
			expect(serializeFields([])).toBe("")
		})

		it("single field serializes without comma", () => {
			fc.assert(
				fc.property(fieldNameArb, (field) => {
					const serialized = serializeFields([field])
					expect(serialized).toBe(field)
					expect(serialized).not.toContain(",")
				}),
				{ numRuns: 100 },
			)
		})
	})

	/**
	 * Feature: qbjs-client-enhancement, Property 13: Field Deduplication
	 * For any array of field names containing duplicates, the serialized output
	 * SHALL contain each unique field name exactly once.
	 * **Validates: Requirements 4.3**
	 */
	describe("Property 13: Field Deduplication", () => {
		it("serializeFields removes duplicates", () => {
			fc.assert(
				fc.property(fc.array(fieldNameArb, { minLength: 1, maxLength: 5 }), (fields) => {
					// Add duplicates
					const withDuplicates = [...fields, ...fields]
					const serialized = serializeFields(withDuplicates)
					const parts = serialized.split(",")

					// Should have same count as unique fields
					const uniqueFields = [...new Set(fields)]
					expect(parts).toHaveLength(uniqueFields.length)

					// Each field should appear exactly once
					for (const field of uniqueFields) {
						const count = parts.filter((p) => p === field).length
						expect(count).toBe(1)
					}
				}),
				{ numRuns: 100 },
			)
		})

		it("QueryBuilder.fields() deduplicates across multiple calls", () => {
			fc.assert(
				fc.property(fieldNameArb, (field) => {
					// Add same field multiple times
					const builder = query().fields(field).fields(field).fields(field)
					const params = builder.toParams()

					expect(params.fields).toHaveLength(1)
					expect(params.fields).toContain(field)
				}),
				{ numRuns: 100 },
			)
		})

		it("QueryBuilder.build() output has deduplicated fields", () => {
			fc.assert(
				fc.property(fc.array(fieldNameArb, { minLength: 2, maxLength: 5 }), (fields) => {
					// Create builder with duplicates
					let builder = query()
					for (const field of fields) {
						builder = builder.fields(field, field) // Add each field twice
					}

					const result = builder.build()
					const parts = result.fields?.split(",") || []
					const uniqueFields = [...new Set(fields)]

					expect(parts).toHaveLength(uniqueFields.length)
				}),
				{ numRuns: 100 },
			)
		})
	})
})
