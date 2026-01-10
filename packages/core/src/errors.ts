/**
 * Error codes for query parameter validation and parsing
 */
export type QueryErrorCode =
	| "INVALID_TYPE"
	| "INVALID_VALUE"
	| "MISSING_REQUIRED"
	| "UNKNOWN_FIELD"
	| "EXCEEDED_LIMIT"
	| "MALFORMED_QUERY"
	| "SECURITY_VIOLATION"
	| "PARSING_FAILED"

/**
 * Warning codes for non-fatal query issues
 */
export type QueryWarningCode = "DEPRECATED_FIELD" | "IGNORED_FIELD" | "DEFAULT_APPLIED" | "PERFORMANCE_WARNING"

/**
 * Detailed error information for query parameter issues
 */
export interface QueryError {
	/** The field that caused the error */
	field: string
	/** Specific error code */
	code: QueryErrorCode
	/** Human-readable error message */
	message: string
	/** Path to the field in nested structures */
	path: string[]
	/** The value that was received */
	received?: any
	/** The expected value or type */
	expected?: any
}

/**
 * Warning information for non-fatal query issues
 */
export interface QueryWarning {
	/** The field that triggered the warning */
	field: string
	/** Specific warning code */
	code: QueryWarningCode
	/** Human-readable warning message */
	message: string
	/** Optional suggestion for improvement */
	suggestion?: string
}

/**
 * Structured error response format for API responses
 */
export interface QueryErrorResponse {
	/** Main error message */
	error: string
	/** Error code for programmatic handling */
	code: string
	/** Detailed error information */
	details: QueryError[]
	/** Non-fatal warnings */
	warnings: QueryWarning[]
	/** Suggestions for fixing the errors */
	suggestions: string[]
	/** Response metadata */
	metadata: {
		/** ISO timestamp of the error */
		timestamp: string
		/** Unique request identifier */
		requestId: string
		/** Time spent parsing before error occurred */
		parseTime: number
	}
}

/**
 * Creates a standardized query error with enhanced path tracking
 */
export function createQueryError(
	field: string,
	code: QueryErrorCode,
	message: string,
	path: string[] = [],
	received?: any,
	expected?: any,
): QueryError {
	return {
		field,
		code,
		message,
		path: path.length > 0 ? path : [field],
		received,
		expected,
	}
}

/**
 * Creates a query error from a Zod validation error
 */
export function createQueryErrorFromZod(zodError: any, fieldPrefix: string = ""): QueryError[] {
	const errors: QueryError[] = []

	if (zodError.issues) {
		for (const issue of zodError.issues) {
			const path = issue.path || []
			const field = fieldPrefix ? `${fieldPrefix}.${path.join(".")}` : path.join(".")

			let code: QueryErrorCode = "INVALID_VALUE"
			let message = issue.message

			// Map Zod error codes to our error codes
			switch (issue.code) {
				case "invalid_type":
					code = "INVALID_TYPE"
					message = ERROR_MESSAGES.INVALID_TYPE(field, issue.expected, issue.received)
					break
				case "too_small":
				case "too_big":
					code = "EXCEEDED_LIMIT"
					message = issue.message
					break
				case "invalid_string":
				case "invalid_enum_value":
					code = "INVALID_VALUE"
					message = ERROR_MESSAGES.INVALID_VALUE(field, issue.received)
					break
				case "unrecognized_keys": {
					code = "UNKNOWN_FIELD"
					// For unrecognized keys, the field should be the key name itself
					const keyField = issue.keys?.[0] || field
					message = ERROR_MESSAGES.UNKNOWN_FIELD(keyField)
					errors.push(createQueryError(keyField, code, message, [keyField], issue.received, issue.expected))
					continue // Skip the normal push since we handled it above
				}
				default:
					code = "INVALID_VALUE"
					message = issue.message
			}

			errors.push(createQueryError(field, code, message, path, issue.received, issue.expected))
		}
	}

	return errors
}

/**
 * Creates a standardized query warning
 */
export function createQueryWarning(
	field: string,
	code: QueryWarningCode,
	message: string,
	suggestion?: string,
): QueryWarning {
	return {
		field,
		code,
		message,
		suggestion,
	}
}

/**
 * Creates a standardized error response with helpful suggestions
 */
export function createErrorResponse(
	error: string,
	code: string,
	details: QueryError[],
	warnings: QueryWarning[] = [],
	suggestions: string[] = [],
	requestId: string = crypto.randomUUID(),
	parseTime: number = 0,
): QueryErrorResponse {
	// Generate helpful suggestions based on error types
	const generatedSuggestions = generateSuggestions(details)
	const allSuggestions = [...suggestions, ...generatedSuggestions]

	return {
		error,
		code,
		details,
		warnings,
		suggestions: allSuggestions,
		metadata: {
			timestamp: new Date().toISOString(),
			requestId,
			parseTime,
		},
	}
}

/**
 * Generates helpful suggestions based on error details
 */
export function generateSuggestions(errors: QueryError[]): string[] {
	const suggestions: string[] = []
	const errorCounts = new Map<QueryErrorCode, number>()

	// Count error types
	for (const error of errors) {
		errorCounts.set(error.code, (errorCounts.get(error.code) || 0) + 1)
	}

	// Generate suggestions based on error patterns
	if (errorCounts.get("UNKNOWN_FIELD")) {
		suggestions.push("Check the API documentation for valid field names")
		suggestions.push("Remove any typos in field names")
	}

	if (errorCounts.get("INVALID_TYPE")) {
		suggestions.push("Ensure numeric values are not quoted in the URL")
		suggestions.push("Check that boolean values are 'true' or 'false'")
	}

	if (errorCounts.get("EXCEEDED_LIMIT")) {
		suggestions.push("Reduce the complexity of your query")
		suggestions.push("Consider breaking complex filters into multiple requests")
	}

	if (errorCounts.get("MALFORMED_QUERY")) {
		suggestions.push("Check URL encoding of special characters")
		suggestions.push("Ensure proper bracket notation for nested objects")
	}

	if (errorCounts.get("INVALID_VALUE")) {
		suggestions.push("Check the format of date and numeric values")
		suggestions.push("Ensure enum values match the allowed options")
	}

	return suggestions
}

/**
 * Creates detailed field-specific error messages with context
 */
export function createFieldError(
	field: string,
	path: string[],
	code: QueryErrorCode,
	received: any,
	expected?: any,
	context?: string,
): QueryError {
	let message: string

	switch (code) {
		case "INVALID_TYPE":
			message = `Field '${field}' expected ${expected} but received ${typeof received} (${received})`
			if (context) message += `. Context: ${context}`
			break
		case "INVALID_VALUE":
			message = `Field '${field}' has invalid value: ${received}`
			if (expected) message += `. Expected: ${expected}`
			if (context) message += `. Context: ${context}`
			break
		case "EXCEEDED_LIMIT":
			message = `Field '${field}' exceeds limits`
			if (expected) message += `. Maximum allowed: ${expected}`
			if (context) message += `. Context: ${context}`
			break
		case "UNKNOWN_FIELD":
			message = `Unknown field '${field}' is not allowed in this context`
			if (context) message += `. Context: ${context}`
			break
		default:
			message = ERROR_MESSAGES.INVALID_VALUE(field, received)
			if (context) message += `. Context: ${context}`
	}

	return createQueryError(field, code, message, path, received, expected)
}

/**
 * Creates a warning for deprecated features with migration guidance
 */
export function createDeprecationWarning(field: string, replacement?: string, version?: string): QueryWarning {
	let message = `Field '${field}' is deprecated`
	if (version) message += ` as of version ${version}`
	if (replacement) message += ` and will be removed in a future version. Use '${replacement}' instead`

	const suggestion = replacement
		? `Replace '${field}' with '${replacement}' in your query parameters`
		: `Remove '${field}' from your query parameters`

	return createQueryWarning(field, "DEPRECATED_FIELD", message, suggestion)
}

/**
 * Common error messages for reuse
 */
export const ERROR_MESSAGES = {
	INVALID_TYPE: (field: string, expected: string, received: string) =>
		`Field '${field}' expected ${expected} but received ${received}`,
	INVALID_VALUE: (field: string, value: any) => `Field '${field}' has invalid value: ${value}`,
	MISSING_REQUIRED: (field: string) => `Required field '${field}' is missing`,
	UNKNOWN_FIELD: (field: string) => `Unknown field '${field}' is not allowed`,
	EXCEEDED_LIMIT: (field: string, limit: number) => `Field '${field}' exceeds maximum limit of ${limit}`,
	MALFORMED_QUERY: (details: string) => `Query string is malformed: ${details}`,
	SECURITY_VIOLATION: (field: string) => `Security violation detected in field '${field}'`,
	PARSING_FAILED: (reason: string) => `Failed to parse query parameters: ${reason}`,
} as const

/**
 * Common warning messages for reuse
 */
export const WARNING_MESSAGES = {
	DEPRECATED_FIELD: (field: string, replacement?: string) =>
		`Field '${field}' is deprecated${replacement ? `, use '${replacement}' instead` : ""}`,
	IGNORED_FIELD: (field: string, reason: string) => `Field '${field}' was ignored: ${reason}`,
	DEFAULT_APPLIED: (field: string, defaultValue: any) => `Default value '${defaultValue}' applied to field '${field}'`,
	PERFORMANCE_WARNING: (field: string, impact: string) => `Performance warning for field '${field}': ${impact}`,
} as const

/**
 * Validation result with detailed error and warning information
 */
export interface ValidationResult<T = any> {
	/** Whether validation was successful */
	success: boolean
	/** Parsed and validated data (only present if success is true) */
	data?: T
	/** Validation errors */
	errors: QueryError[]
	/** Non-fatal warnings */
	warnings: QueryWarning[]
	/** Helpful suggestions for fixing errors */
	suggestions: string[]
}

/**
 * Validates query parameters with enhanced error reporting
 */
export function validateQuery<T>(data: any, schema: any, context: string = "query"): ValidationResult<T> {
	try {
		const result = schema.safeParse(data)

		if (result.success) {
			return {
				success: true,
				data: result.data,
				errors: [],
				warnings: [],
				suggestions: [],
			}
		} else {
			const errors = createQueryErrorFromZod(result.error, context)
			const suggestions = generateSuggestions(errors)

			return {
				success: false,
				errors,
				warnings: [],
				suggestions,
			}
		}
	} catch (error) {
		const queryError = createQueryError(
			context,
			"PARSING_FAILED",
			`Failed to validate ${context}: ${error instanceof Error ? error.message : "Unknown error"}`,
			[context],
			data,
		)

		return {
			success: false,
			errors: [queryError],
			warnings: [],
			suggestions: ["Check the query parameter format", "Ensure all required fields are present"],
		}
	}
}

/**
 * Combines multiple validation results
 */
export function combineValidationResults<T>(results: ValidationResult<any>[]): ValidationResult<T[]> {
	const allErrors: QueryError[] = []
	const allWarnings: QueryWarning[] = []
	const allSuggestions: string[] = []
	const allData: any[] = []

	let allSuccessful = true

	for (const result of results) {
		if (!result.success) {
			allSuccessful = false
		}

		allErrors.push(...result.errors)
		allWarnings.push(...result.warnings)
		allSuggestions.push(...result.suggestions)

		if (result.data !== undefined) {
			allData.push(result.data)
		}
	}

	// Remove duplicate suggestions
	const uniqueSuggestions = [...new Set(allSuggestions)]

	return {
		success: allSuccessful,
		data: allSuccessful ? (allData as T[]) : undefined,
		errors: allErrors,
		warnings: allWarnings,
		suggestions: uniqueSuggestions,
	}
}
