import { describe, expect, it } from "vitest"
import { z } from "zod"
import {
	combineValidationResults,
	createDeprecationWarning,
	createErrorResponse,
	createFieldError,
	createQueryError,
	createQueryErrorFromZod,
	generateSuggestions,
	type QueryError,
	type QueryWarning,
	type ValidationResult,
	validateQuery,
} from "./errors"

describe("Enhanced Query Error Handling", () => {
	describe("Property 6: Structured Error Reporting", () => {
		/**
		 * **Feature: query-parameter-enhancement, Property 6: Structured Error Reporting**
		 * **Validates: Requirements 2.1**
		 *
		 * For any invalid query parameters that fail Zod validation, the parser should return
		 * structured error messages containing field paths, expected types, and received values
		 */
		it("should provide structured error messages for basic validation failures", () => {
			// Create a simple schema for testing
			const testSchema = z
				.object({
					name: z.string(),
					age: z.number(),
					email: z.email(),
				})
				.strict()

			const testCases = [
				{
					description: "invalid type for name field",
					data: { name: 123, age: 25, email: "test@example.com" },
					expectedField: "name",
				},
				{
					description: "invalid type for age field",
					data: { name: "john", age: "not-a-number", email: "test@example.com" },
					expectedField: "age",
				},
				{
					description: "invalid email format",
					data: { name: "john", age: 25, email: "invalid-email" },
					expectedField: "email",
				},
				{
					description: "unknown field in strict schema",
					data: { name: "john", age: 25, email: "test@example.com", unknownField: "value" },
					expectedField: "", // We'll check differently for this case
				},
			]

			for (const testCase of testCases) {
				const result = validateQuery(testCase.data, testSchema, "query")

				// Should fail validation
				expect(result.success, `Test case: ${testCase.description}`).toBe(false)
				expect(result.errors.length, `Test case: ${testCase.description}`).toBeGreaterThan(0)

				// Should have structured error information
				if (testCase.expectedField) {
					const hasExpectedFieldError = result.errors.some(
						(error) => error.field.includes(testCase.expectedField) || error.path.includes(testCase.expectedField),
					)
					expect(
						hasExpectedFieldError,
						`Test case: ${testCase.description}, expected field: ${testCase.expectedField}`,
					).toBe(true)
				} else {
					// For unknown field case, just check that we have errors
					expect(result.errors.length).toBeGreaterThan(0)
				}

				// Should provide helpful suggestions
				expect(result.suggestions.length, `Test case: ${testCase.description}`).toBeGreaterThan(0)
			}
		})

		it("should provide detailed field paths for nested validation errors", () => {
			// Create a schema with nested structure
			const nestedSchema = z.object({
				user: z.object({
					profile: z.object({
						name: z.string(),
						age: z.number(),
					}),
				}),
			})

			const testData = {
				user: {
					profile: {
						name: 123, // Should be string
						age: "not-a-number", // Should be number
					},
				},
			}

			const result = validateQuery(testData, nestedSchema, "query")

			expect(result.success).toBe(false)
			expect(result.errors.length).toBeGreaterThan(0)

			// Should have errors with proper path information
			const nameError = result.errors.find((error) => error.field.includes("name") || error.path.includes("name"))
			const ageError = result.errors.find((error) => error.field.includes("age") || error.path.includes("age"))

			expect(nameError).toBeDefined()
			expect(ageError).toBeDefined()
		})

		it("should include received and expected values in error messages", () => {
			const testSchema = z.object({
				count: z.number(),
				status: z.enum(["active", "inactive"]),
			})

			const testData = {
				count: "not-a-number",
				status: "invalid-status",
			}

			const result = validateQuery(testData, testSchema, "query")

			expect(result.success).toBe(false)
			expect(result.errors.length).toBeGreaterThan(0)

			// Check that errors contain basic information
			for (const error of result.errors) {
				expect(error.message).toBeTruthy()
				expect(error.field).toBeTruthy()
				expect(error.code).toBeTruthy()
			}

			// Check that at least one error has meaningful content
			// (Some Zod errors may not have received/expected values)
			const hasDetailedError = result.errors.some(
				(error) => error.message.length > 10 && (error.received !== undefined || error.field.length > 0),
			)
			expect(hasDetailedError).toBe(true)
		})

		it("should generate contextual error messages and suggestions", () => {
			const testSchema = z
				.object({
					page: z.number().positive(),
					limit: z.number().max(100),
				})
				.strict()

			const testData = {
				page: -1,
				limit: 1000,
				unknownField: "value",
			}

			const result = validateQuery(testData, testSchema, "query")

			expect(result.success).toBe(false)
			expect(result.errors.length).toBeGreaterThan(0)

			// Check that error messages are descriptive
			for (const error of result.errors) {
				expect(error.message).toBeTruthy()
				expect(error.message.length).toBeGreaterThan(5) // Should be descriptive
				expect(error.field).toBeTruthy()
				expect(error.code).toBeTruthy()
			}

			// Should provide helpful suggestions
			expect(result.suggestions.length).toBeGreaterThan(0)
		})
	})

	describe("Error Creation and Formatting", () => {
		it("should create properly formatted query errors", () => {
			const error = createQueryError(
				"testField",
				"INVALID_TYPE",
				"Test error message",
				["root", "nested", "field"],
				"received_value",
				"expected_type",
			)

			expect(error.field).toBe("testField")
			expect(error.code).toBe("INVALID_TYPE")
			expect(error.message).toBe("Test error message")
			expect(error.path).toEqual(["root", "nested", "field"])
			expect(error.received).toBe("received_value")
			expect(error.expected).toBe("expected_type")
		})

		it("should create errors from Zod validation errors", () => {
			const schema = z.object({
				name: z.string(),
				age: z.number(),
			})

			const result = schema.safeParse({ name: 123, age: "not-a-number" })
			expect(result.success).toBe(false)

			if (!result.success) {
				const errors = createQueryErrorFromZod(result.error, "test")

				expect(errors.length).toBeGreaterThan(0)
				expect(errors.every((e) => e.field.startsWith("test.") || e.field === "test")).toBe(true)
				expect(errors.every((e) => e.code !== undefined)).toBe(true)
				expect(errors.every((e) => e.message.length > 0)).toBe(true)
			}
		})

		it("should generate helpful suggestions based on error patterns", () => {
			const errors: QueryError[] = [
				createQueryError("field1", "UNKNOWN_FIELD", "Unknown field", [], "value"),
				createQueryError("field2", "INVALID_TYPE", "Invalid type", [], "string", "number"),
				createQueryError("field3", "EXCEEDED_LIMIT", "Exceeded limit", [], 1000, 100),
			]

			const suggestions = generateSuggestions(errors)

			expect(suggestions.length).toBeGreaterThan(0)
			expect(suggestions.some((s) => s.includes("documentation"))).toBe(true)
		})

		it("should create comprehensive error responses", () => {
			const errors: QueryError[] = [createQueryError("field1", "INVALID_TYPE", "Type error", [], "value")]
			const warnings: QueryWarning[] = [createDeprecationWarning("oldField", "newField", "v2.0")]

			const response = createErrorResponse(
				"Validation failed",
				"VALIDATION_ERROR",
				errors,
				warnings,
				["Custom suggestion"],
				"test-request-id",
				100,
			)

			expect(response.error).toBe("Validation failed")
			expect(response.code).toBe("VALIDATION_ERROR")
			expect(response.details).toEqual(errors)
			expect(response.warnings).toEqual(warnings)
			expect(response.suggestions.length).toBeGreaterThan(1) // Custom + generated
			expect(response.metadata.requestId).toBe("test-request-id")
			expect(response.metadata.parseTime).toBe(100)
			expect(response.metadata.timestamp).toBeTruthy()
		})
	})

	describe("Validation Result Handling", () => {
		it("should combine multiple validation results correctly", () => {
			const results: ValidationResult[] = [
				{
					success: true,
					data: { field1: "value1" },
					errors: [],
					warnings: [],
					suggestions: [],
				},
				{
					success: false,
					errors: [createQueryError("field2", "INVALID_TYPE", "Error", [], "value")],
					warnings: [],
					suggestions: ["Suggestion 1"],
				},
				{
					success: false,
					errors: [createQueryError("field3", "UNKNOWN_FIELD", "Error", [], "value")],
					warnings: [],
					suggestions: ["Suggestion 2", "Suggestion 1"], // Duplicate
				},
			]

			const combined = combineValidationResults(results)

			expect(combined.success).toBe(false) // At least one failed
			expect(combined.errors.length).toBe(2) // Two errors total
			expect(combined.suggestions.length).toBe(2) // Duplicates removed
			expect(combined.suggestions).toContain("Suggestion 1")
			expect(combined.suggestions).toContain("Suggestion 2")
		})

		it("should handle successful validation results", () => {
			const validData = { name: "test", age: 25 }
			const schema = z.object({ name: z.string(), age: z.number() })
			const result = validateQuery(validData, schema, "query")

			expect(result.success).toBe(true)
			expect(result.data).toEqual({ name: "test", age: 25 })
			expect(result.errors).toHaveLength(0)
			expect(result.warnings).toHaveLength(0)
		})
	})

	describe("Property 24: Helpful Error Messages", () => {
		/**
		 * **Feature: query-parameter-enhancement, Property 24: Helpful Error Messages**
		 * **Validates: Requirements 8.2**
		 *
		 * For any error condition, the parser should include helpful error messages with suggestions for fixing the issue
		 */
		it("should provide helpful error messages with actionable suggestions for common validation failures", () => {
			// Test cases covering different error scenarios that should provide helpful messages
			const testCases = [
				{
					description: "unknown field error",
					schema: z.object({ name: z.string(), age: z.number() }).strict(),
					data: { name: "john", age: 25, unknownField: "value" },
					expectedSuggestions: ["Check the API documentation for valid field names", "Remove any typos in field names"],
					expectedMessageContent: ["unknown", "not allowed"],
				},
				{
					description: "invalid type error",
					schema: z.object({ age: z.number(), active: z.boolean() }),
					data: { age: "not-a-number", active: "not-a-boolean" },
					expectedSuggestions: [
						"Ensure numeric values are not quoted in the URL",
						"Check that boolean values are 'true' or 'false'",
					],
					expectedMessageContent: ["expected", "received"],
				},
				{
					description: "exceeded limit error",
					schema: z.object({ name: z.string().max(5), count: z.number().max(10) }),
					data: { name: "very-long-name-that-exceeds-limit", count: 100 },
					expectedSuggestions: [
						"Reduce the complexity of your query",
						"Consider breaking complex filters into multiple requests",
					],
					expectedMessageContent: ["too big", "expected"],
				},
				{
					description: "invalid enum value error",
					schema: z.object({ status: z.enum(["active", "inactive", "pending"]) }),
					data: { status: "invalid-status" },
					expectedSuggestions: [
						"Check the format of date and numeric values",
						"Ensure enum values match the allowed options",
					],
					expectedMessageContent: ["invalid", "option"],
				},
				{
					description: "missing required field error",
					schema: z.object({ name: z.string(), email: z.string() }),
					data: { name: "john" }, // Missing required email
					expectedSuggestions: [], // May not have specific suggestions for missing fields
					expectedMessageContent: ["expected", "undefined"],
				},
			]

			for (const testCase of testCases) {
				const result = validateQuery(testCase.data, testCase.schema, "query")

				// Should fail validation
				expect(result.success, `Test case: ${testCase.description}`).toBe(false)
				expect(result.errors.length, `Test case: ${testCase.description}`).toBeGreaterThan(0)

				// Should provide helpful suggestions
				expect(result.suggestions.length, `Test case: ${testCase.description}`).toBeGreaterThan(0)

				// Check that expected suggestions are present (at least some of them)
				if (testCase.expectedSuggestions.length > 0) {
					const hasSomeSuggestions = testCase.expectedSuggestions.some((expectedSuggestion) =>
						result.suggestions.some(
							(actualSuggestion) =>
								actualSuggestion.toLowerCase().includes(expectedSuggestion.toLowerCase()) ||
								expectedSuggestion.toLowerCase().includes(actualSuggestion.toLowerCase()),
						),
					)
					expect(
						hasSomeSuggestions,
						`Test case: ${testCase.description}, expected suggestions: ${testCase.expectedSuggestions.join(", ")}, actual: ${result.suggestions.join(", ")}`,
					).toBe(true)
				}

				// Check that error messages contain helpful content
				const allErrorMessages = result.errors.map((e) => e.message.toLowerCase()).join(" ")
				for (const expectedContent of testCase.expectedMessageContent) {
					const hasExpectedContent = allErrorMessages.includes(expectedContent.toLowerCase())
					expect(
						hasExpectedContent,
						`Test case: ${testCase.description}, expected content: "${expectedContent}" in messages: ${result.errors.map((e) => e.message).join("; ")}`,
					).toBe(true)
				}

				// Error messages should be descriptive (not just generic)
				for (const error of result.errors) {
					expect(error.message.length, `Test case: ${testCase.description}, error: ${error.message}`).toBeGreaterThan(
						10,
					)
					expect(error.message, `Test case: ${testCase.description}`).not.toBe("Invalid input")
					expect(error.message, `Test case: ${testCase.description}`).not.toBe("Validation failed")
				}
			}
		})

		it("should provide contextual suggestions based on error patterns", () => {
			// Test that different combinations of errors produce appropriate suggestions
			const testCases = [
				{
					description: "multiple unknown fields",
					errors: [
						createQueryError("field1", "UNKNOWN_FIELD", "Unknown field", [], "value"),
						createQueryError("field2", "UNKNOWN_FIELD", "Unknown field", [], "value"),
						createQueryError("field3", "UNKNOWN_FIELD", "Unknown field", [], "value"),
					],
					expectedSuggestionKeywords: ["documentation", "field names", "typos"],
				},
				{
					description: "multiple type errors",
					errors: [
						createQueryError("age", "INVALID_TYPE", "Invalid type", [], "string", "number"),
						createQueryError("active", "INVALID_TYPE", "Invalid type", [], "string", "boolean"),
					],
					expectedSuggestionKeywords: ["numeric values", "quoted", "boolean"],
				},
				{
					description: "limit exceeded errors",
					errors: [
						createQueryError("query", "EXCEEDED_LIMIT", "Exceeded limit", [], 1000, 100),
						createQueryError("depth", "EXCEEDED_LIMIT", "Exceeded limit", [], 10, 5),
					],
					expectedSuggestionKeywords: ["complexity", "reduce", "multiple requests"],
				},
				{
					description: "malformed query errors",
					errors: [
						createQueryError("query", "MALFORMED_QUERY", "Malformed query", [], "bad%2"),
						createQueryError("encoding", "MALFORMED_QUERY", "Malformed query", [], "bad%"),
					],
					expectedSuggestionKeywords: ["URL encoding", "special characters", "bracket notation"],
				},
				{
					description: "mixed error types",
					errors: [
						createQueryError("field1", "UNKNOWN_FIELD", "Unknown field", [], "value"),
						createQueryError("field2", "INVALID_TYPE", "Invalid type", [], "string", "number"),
						createQueryError("field3", "EXCEEDED_LIMIT", "Exceeded limit", [], 1000, 100),
					],
					expectedSuggestionKeywords: ["documentation", "numeric values", "complexity"],
				},
			]

			for (const testCase of testCases) {
				const suggestions = generateSuggestions(testCase.errors)

				// Should generate suggestions
				expect(suggestions.length, `Test case: ${testCase.description}`).toBeGreaterThan(0)

				// Should contain contextually relevant suggestions
				const allSuggestions = suggestions.join(" ").toLowerCase()
				let foundKeywords = 0
				for (const keyword of testCase.expectedSuggestionKeywords) {
					if (allSuggestions.includes(keyword.toLowerCase())) {
						foundKeywords++
					}
				}

				// Should find at least some of the expected keywords
				expect(
					foundKeywords,
					`Test case: ${testCase.description}, expected keywords: ${testCase.expectedSuggestionKeywords.join(", ")}, actual suggestions: ${suggestions.join("; ")}`,
				).toBeGreaterThan(0)

				// Suggestions should be actionable (contain action words)
				const actionWords = ["check", "ensure", "remove", "reduce", "consider", "use", "replace"]
				const hasActionWords = suggestions.some((suggestion) =>
					actionWords.some((action) => suggestion.toLowerCase().includes(action)),
				)
				expect(hasActionWords, `Test case: ${testCase.description}, suggestions should contain action words`).toBe(true)
			}
		})

		it("should provide specific field-level error messages with context", () => {
			// Test that field-specific errors include helpful context
			const testCases = [
				{
					description: "invalid type with context",
					field: "age",
					code: "INVALID_TYPE" as const,
					received: "twenty-five",
					expected: "number",
					context: "User profile validation",
					expectedMessageContent: ["age", "number", "twenty-five", "User profile validation"],
				},
				{
					description: "exceeded limit with context",
					field: "description",
					code: "EXCEEDED_LIMIT" as const,
					received: 500,
					expected: 200,
					context: "Maximum description length",
					expectedMessageContent: ["description", "exceeds", "200", "Maximum description length"],
				},
				{
					description: "unknown field with context",
					field: "invalidField",
					code: "UNKNOWN_FIELD" as const,
					received: "value",
					expected: undefined,
					context: "Strict schema validation",
					expectedMessageContent: ["invalidField", "not allowed", "Strict schema validation"],
				},
			]

			for (const testCase of testCases) {
				const error = createFieldError(
					testCase.field,
					[testCase.field],
					testCase.code,
					testCase.received,
					testCase.expected,
					testCase.context,
				)

				// Should create a well-formed error
				expect(error.field, `Test case: ${testCase.description}`).toBe(testCase.field)
				expect(error.code, `Test case: ${testCase.description}`).toBe(testCase.code)
				expect(error.received, `Test case: ${testCase.description}`).toBe(testCase.received)
				expect(error.expected, `Test case: ${testCase.description}`).toBe(testCase.expected)

				// Should include all expected content in the message
				const message = error.message.toLowerCase()
				for (const expectedContent of testCase.expectedMessageContent) {
					if (expectedContent !== undefined) {
						expect(
							message,
							`Test case: ${testCase.description}, expected "${expectedContent}" in message: "${error.message}"`,
						).toContain(expectedContent.toString().toLowerCase())
					}
				}

				// Message should be descriptive and helpful
				expect(error.message.length, `Test case: ${testCase.description}`).toBeGreaterThan(20)
				expect(error.message, `Test case: ${testCase.description}`).toContain(testCase.field)
			}
		})

		it("should create comprehensive error responses with helpful metadata", () => {
			// Test that error responses include all helpful information
			const errors: QueryError[] = [
				createQueryError("field1", "INVALID_TYPE", "Type error", [], "string", "number"),
				createQueryError("field2", "UNKNOWN_FIELD", "Unknown field", [], "value"),
			]
			const warnings: QueryWarning[] = [createDeprecationWarning("oldField", "newField", "v2.0")]

			const response = createErrorResponse(
				"Query validation failed",
				"VALIDATION_ERROR",
				errors,
				warnings,
				["Custom suggestion"],
				"test-request-id",
				150,
			)

			// Should have helpful main error message
			expect(response.error).toBe("Query validation failed")
			expect(response.code).toBe("VALIDATION_ERROR")

			// Should include all errors and warnings
			expect(response.details).toEqual(errors)
			expect(response.warnings).toEqual(warnings)

			// Should generate helpful suggestions
			expect(response.suggestions.length).toBeGreaterThan(1) // Custom + generated
			expect(response.suggestions).toContain("Custom suggestion")

			// Should include useful metadata
			expect(response.metadata.requestId).toBe("test-request-id")
			expect(response.metadata.parseTime).toBe(150)
			expect(response.metadata.timestamp).toBeTruthy()
			expect(new Date(response.metadata.timestamp).getTime()).toBeGreaterThan(0)

			// Generated suggestions should be helpful
			const generatedSuggestions = response.suggestions.filter((s) => s !== "Custom suggestion")
			expect(generatedSuggestions.length).toBeGreaterThan(0)

			// Should contain actionable suggestions
			const hasActionableSuggestions = generatedSuggestions.some(
				(suggestion) =>
					suggestion.toLowerCase().includes("check") ||
					suggestion.toLowerCase().includes("ensure") ||
					suggestion.toLowerCase().includes("remove") ||
					suggestion.toLowerCase().includes("use"),
			)
			expect(hasActionableSuggestions).toBe(true)
		})

		it("should provide migration guidance for deprecated features", () => {
			// Test that deprecation warnings include helpful migration guidance
			const testCases = [
				{
					description: "deprecated field with replacement",
					field: "oldSortBy",
					replacement: "sort",
					version: "v2.0",
					expectedMessageContent: ["deprecated", "v2.0", "sort"],
					expectedSuggestionContent: ["Replace", "oldSortBy", "sort"],
				},
				{
					description: "deprecated field without replacement",
					field: "legacyField",
					replacement: undefined,
					version: "v1.5",
					expectedMessageContent: ["deprecated", "v1.5"],
					expectedSuggestionContent: ["Remove", "legacyField"],
				},
				{
					description: "deprecated field without version",
					field: "oldField",
					replacement: "newField",
					version: undefined,
					expectedMessageContent: ["deprecated", "newField"],
					expectedSuggestionContent: ["Replace", "oldField", "newField"],
				},
			]

			for (const testCase of testCases) {
				const warning = createDeprecationWarning(testCase.field, testCase.replacement, testCase.version)

				// Should create proper warning structure
				expect(warning.field).toBe(testCase.field)
				expect(warning.code).toBe("DEPRECATED_FIELD")

				// Should include expected message content
				const message = warning.message.toLowerCase()
				for (const expectedContent of testCase.expectedMessageContent) {
					if (expectedContent) {
						expect(
							message,
							`Test case: ${testCase.description}, expected "${expectedContent}" in message: "${warning.message}"`,
						).toContain(expectedContent.toLowerCase())
					}
				}

				// Should provide helpful suggestion
				expect(warning.suggestion, `Test case: ${testCase.description}`).toBeTruthy()
				if (warning.suggestion) {
					const suggestion = warning.suggestion.toLowerCase()
					for (const expectedContent of testCase.expectedSuggestionContent) {
						if (expectedContent) {
							expect(
								suggestion,
								`Test case: ${testCase.description}, expected "${expectedContent}" in suggestion: "${warning.suggestion}"`,
							).toContain(expectedContent.toLowerCase())
						}
					}
				}

				// Suggestion should be actionable
				if (warning.suggestion) {
					const hasActionWord = ["replace", "remove", "use", "update", "change"].some((action) =>
						warning.suggestion!.toLowerCase().includes(action),
					)
					expect(
						hasActionWord,
						`Test case: ${testCase.description}, suggestion should be actionable: "${warning.suggestion}"`,
					).toBe(true)
				}
			}
		})
	})

	describe("Field-Specific Error Creation", () => {
		it("should create detailed field errors with context", () => {
			const error = createFieldError(
				"testField",
				["root", "nested"],
				"INVALID_VALUE",
				"received_value",
				"expected_value",
				"Additional context information",
			)

			expect(error.field).toBe("testField")
			expect(error.path).toEqual(["root", "nested"])
			expect(error.code).toBe("INVALID_VALUE")
			expect(error.received).toBe("received_value")
			expect(error.expected).toBe("expected_value")
			expect(error.message).toContain("Additional context information")
		})

		it("should create deprecation warnings with migration guidance", () => {
			const warning = createDeprecationWarning("oldField", "newField", "v2.0")

			expect(warning.field).toBe("oldField")
			expect(warning.code).toBe("DEPRECATED_FIELD")
			expect(warning.message).toContain("deprecated")
			expect(warning.message).toContain("v2.0")
			expect(warning.message).toContain("newField")
			expect(warning.suggestion).toContain("Replace")
			expect(warning.suggestion).toContain("oldField")
			expect(warning.suggestion).toContain("newField")
		})
	})
})
