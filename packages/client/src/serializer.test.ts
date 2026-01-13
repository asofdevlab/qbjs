/**
 * Property-based tests for serializer module
 *
 * Feature: qbjs-client-enhancement
 * @module serializer.test
 */

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import { f } from "./index"
import { serializeFilter, toQueryString } from "./serializer"
import type { Filter } from "./types"

describe("Serializer", () => {
	/**
	 * Feature: qbjs-client-enhancement, Property 14: Filter Serialization Bracket Notation
	 * For any filter object, the serialized output SHALL use bracket notation
	 * compatible with the qs library format (e.g., "filter[field][op]=value").
	 * **Validates: Requirements 5.1**
	 */
	describe("Property 14: Filter Serialization Bracket Notation", () => {
		// Arbitrary for generating valid field names (alphanumeric, no special chars)
		const fieldNameArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s))

		// Arbitrary for generating simple string values
		const simpleValueArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0)

		it("simple field filter uses bracket notation filter[field][operator]=value", () => {
			fc.assert(
				fc.property(fieldNameArb, simpleValueArb, (field, value) => {
					const filter: Filter = { [field]: { eq: value } }
					const result = serializeFilter(filter)

					// Should contain the bracket notation pattern
					expect(result).toContain(`filter%5B${field}%5D%5Beq%5D=`)
					// The value should be URL encoded
					expect(result).toContain(encodeURIComponent(value))
				}),
				{ numRuns: 100 },
			)
		})

		it("multiple operators on same field produce multiple bracket notation entries", () => {
			fc.assert(
				fc.property(
					fieldNameArb,
					fc.integer({ min: 0, max: 100 }),
					fc.integer({ min: 0, max: 100 }),
					(field, min, max) => {
						const filter: Filter = { [field]: { gte: min, lte: max } }
						const result = serializeFilter(filter)

						// Should contain both operators in bracket notation
						expect(result).toContain(`filter%5B${field}%5D%5Bgte%5D=`)
						expect(result).toContain(`filter%5B${field}%5D%5Blte%5D=`)
					},
				),
				{ numRuns: 100 },
			)
		})

		it("logical AND filter uses indexed bracket notation filter[and][index][field][op]=value", () => {
			fc.assert(
				fc.property(fieldNameArb, fieldNameArb, simpleValueArb, simpleValueArb, (field1, field2, value1, value2) => {
					// Ensure different field names
					const f2 = field1 === field2 ? `${field2}_2` : field2

					const filter: Filter = f.and({ [field1]: { eq: value1 } }, { [f2]: { eq: value2 } })
					const result = serializeFilter(filter)

					// Should contain indexed bracket notation for AND
					expect(result).toContain("filter%5Band%5D%5B0%5D")
					expect(result).toContain("filter%5Band%5D%5B1%5D")
				}),
				{ numRuns: 100 },
			)
		})

		it("logical OR filter uses indexed bracket notation filter[or][index][field][op]=value", () => {
			fc.assert(
				fc.property(fieldNameArb, fieldNameArb, simpleValueArb, simpleValueArb, (field1, field2, value1, value2) => {
					const f2 = field1 === field2 ? `${field2}_2` : field2

					const filter: Filter = f.or({ [field1]: { eq: value1 } }, { [f2]: { eq: value2 } })
					const result = serializeFilter(filter)

					// Should contain indexed bracket notation for OR
					expect(result).toContain("filter%5Bor%5D%5B0%5D")
					expect(result).toContain("filter%5Bor%5D%5B1%5D")
				}),
				{ numRuns: 100 },
			)
		})

		it("logical NOT filter uses bracket notation filter[not][field][op]=value", () => {
			fc.assert(
				fc.property(fieldNameArb, simpleValueArb, (field, value) => {
					const filter: Filter = f.not({ [field]: { eq: value } })
					const result = serializeFilter(filter)

					// Should contain NOT bracket notation
					expect(result).toContain("filter%5Bnot%5D")
					expect(result).toContain(`%5B${field}%5D%5Beq%5D`)
				}),
				{ numRuns: 100 },
			)
		})

		it("array values (in operator) use indexed bracket notation", () => {
			fc.assert(
				fc.property(fieldNameArb, fc.array(fc.integer(), { minLength: 1, maxLength: 5 }), (field, values) => {
					const filter: Filter = { [field]: { in: values } }
					const result = serializeFilter(filter)

					// Should contain indexed bracket notation for array values
					for (let i = 0; i < values.length; i++) {
						expect(result).toContain(`filter%5B${field}%5D%5Bin%5D%5B${i}%5D=`)
					}
				}),
				{ numRuns: 100 },
			)
		})
	})

	/**
	 * Feature: qbjs-client-enhancement, Property 15: Special Character Encoding
	 * For any filter value containing special characters (spaces, &, =, etc.),
	 * the serialized output SHALL URL-encode those characters.
	 * **Validates: Requirements 5.3**
	 */
	describe("Property 15: Special Character Encoding", () => {
		const fieldNameArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s))

		// Special characters that need encoding
		const specialChars = [" ", "&", "=", "?", "#", "%", "+", "/", "\\", '"', "'", "<", ">"]

		it("spaces in values are URL encoded", () => {
			fc.assert(
				fc.property(fieldNameArb, fc.string({ minLength: 1 }), (field, baseValue) => {
					const valueWithSpace = `${baseValue} test`
					const filter: Filter = { [field]: { eq: valueWithSpace } }
					const result = serializeFilter(filter)

					// Space should be encoded as %20
					expect(result).not.toContain(" ")
					// The encoded value should be present
					expect(result).toContain(encodeURIComponent(valueWithSpace))
				}),
				{ numRuns: 100 },
			)
		})

		it("ampersand in values is URL encoded", () => {
			fc.assert(
				fc.property(fieldNameArb, (field) => {
					const valueWithAmpersand = "foo&bar"
					const filter: Filter = { [field]: { eq: valueWithAmpersand } }
					const result = serializeFilter(filter)

					// Ampersand in value should be encoded
					// The result will have & as separator, but the value should have %26
					expect(result).toContain(encodeURIComponent(valueWithAmpersand))
				}),
				{ numRuns: 100 },
			)
		})

		it("equals sign in values is URL encoded", () => {
			fc.assert(
				fc.property(fieldNameArb, (field) => {
					const valueWithEquals = "foo=bar"
					const filter: Filter = { [field]: { eq: valueWithEquals } }
					const result = serializeFilter(filter)

					// Equals in value should be encoded as %3D
					expect(result).toContain(encodeURIComponent(valueWithEquals))
				}),
				{ numRuns: 100 },
			)
		})

		it("any special character in values is properly URL encoded", () => {
			fc.assert(
				fc.property(
					fieldNameArb,
					fc.constantFrom(...specialChars),
					fc.string({ minLength: 1, maxLength: 10 }),
					(field, specialChar, baseValue) => {
						const valueWithSpecial = `${baseValue}${specialChar}test`
						const filter: Filter = { [field]: { eq: valueWithSpecial } }
						const result = serializeFilter(filter)

						// The encoded value should be present
						expect(result).toContain(encodeURIComponent(valueWithSpecial))
					},
				),
				{ numRuns: 100 },
			)
		})

		it("toQueryString encodes all parts correctly", () => {
			fc.assert(
				fc.property(
					fieldNameArb,
					fc.string({ minLength: 1, maxLength: 20 }),
					fc.integer({ min: 1, max: 100 }),
					fc.integer({ min: 1, max: 100 }),
					(field, value, page, limit) => {
						const result = toQueryString({
							page,
							limit,
							filter: { [field]: { eq: value } },
						})

						// Should be a valid query string (no unencoded special chars in values)
						// Page and limit should be present
						expect(result).toContain(`page=${page}`)
						expect(result).toContain(`limit=${limit}`)
						// Filter should use bracket notation
						expect(result).toContain("filter%5B")
					},
				),
				{ numRuns: 100 },
			)
		})

		it("unicode characters are properly encoded", () => {
			// Test with strings containing non-ASCII characters
			const unicodeStrings = ["日本語", "中文", "한국어", "العربية", "🎉🚀", "café", "naïve"]

			for (const unicodeValue of unicodeStrings) {
				const filter: Filter = { testField: { eq: unicodeValue } }
				const result = serializeFilter(filter)

				// The result should contain the URL-encoded unicode value
				expect(result).toContain(encodeURIComponent(unicodeValue))
			}
		})
	})
})
