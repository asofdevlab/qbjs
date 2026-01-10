import { z } from "zod"

/**
 * Enhanced base query schema with qs library support
 * This replaces the basic querySchema with more robust parsing capabilities
 * Designed to work with qs-parsed query strings that create nested objects
 */
export const enhancedQuerySchema = z.object({
	/** Comma-separated list of fields to include in response */
	fields: z.string().optional(),
	/** Page number for pagination (1-based) */
	page: z.coerce.number().int().positive().default(1),
	/** Number of items per page */
	limit: z.coerce.number().int().positive().max(100).default(10),
	/** Sort specification (e.g., "name:asc,createdAt:desc") */
	sort: z.string().optional(),
	/** Complex filter object (parsed by qs into nested structures) */
	filter: z.record(z.string(), z.any()).optional(),
})

/**
 * Filter operator schema with comprehensive type support
 * Supports all common database query operators with proper type validation
 * Designed to work with qs-parsed nested filter structures
 */
export const filterOperatorSchema = z
	.object({
		/** Equals (case-sensitive) */
		eq: z.any().optional(),
		/** Equals (case-insensitive) */
		eqi: z.string().optional(),
		/** Not equals (case-sensitive) */
		ne: z.any().optional(),
		/** Not equals (case-insensitive) */
		nei: z.string().optional(),
		/** Less than */
		lt: z.union([z.string(), z.number(), z.date(), z.coerce.number(), z.coerce.date()]).optional(),
		/** Less than or equal */
		lte: z.union([z.string(), z.number(), z.date(), z.coerce.number(), z.coerce.date()]).optional(),
		/** Greater than */
		gt: z.union([z.string(), z.number(), z.date(), z.coerce.number(), z.coerce.date()]).optional(),
		/** Greater than or equal */
		gte: z.union([z.string(), z.number(), z.date(), z.coerce.number(), z.coerce.date()]).optional(),
		/** In array of values */
		in: z.array(z.any()).optional(),
		/** Not in array of values */
		notIn: z.array(z.any()).optional(),
		/** Contains substring (case-sensitive) */
		contains: z.string().optional(),
		/** Does not contain substring (case-sensitive) */
		notContains: z.string().optional(),
		/** Contains substring (case-insensitive) */
		containsi: z.string().optional(),
		/** Does not contain substring (case-insensitive) */
		notContainsi: z.string().optional(),
		/** Is null */
		null: z.boolean().optional(),
		/** Is not null */
		notNull: z.boolean().optional(),
		/** Between two values (inclusive) */
		between: z.tuple([z.any(), z.any()]).optional(),
		/** Starts with string */
		startsWith: z.string().optional(),
		/** Ends with string */
		endsWith: z.string().optional(),
	})
	.strict() // Prevent unknown properties for better validation

/**
 * Logical operators for complex filtering
 * Supports nested logical operations with AND, OR, NOT
 * Designed to handle qs-parsed nested filter structures like:
 * filter[and][0][name][eq]=John&filter[and][1][age][gt]=18
 */
export const logicalFilterSchema: z.ZodType<any> = z.lazy(() =>
	z
		.object({
			/** Logical AND - all conditions must be true */
			and: z.array(logicalFilterSchema).optional(),
			/** Logical OR - at least one condition must be true */
			or: z.array(logicalFilterSchema).optional(),
			/** Logical NOT - condition must be false */
			not: logicalFilterSchema.optional(),
		})
		.catchall(filterOperatorSchema)
		.refine(
			(data) => {
				// Ensure at least one property is present
				const hasLogical = data.and || data.or || data.not
				const hasOperators = Object.keys(data).some((key) => !["and", "or", "not"].includes(key))
				return hasLogical || hasOperators
			},
			{
				message: "Filter must contain at least one logical operator or field operator",
			},
		),
)

/**
 * Schema for field selection queries
 * Used for the "fields" parameter
 */
export const fieldSelectionSchema = z.object({
	/** Fields to include */
	include: z.array(z.string()).optional(),
	/** Fields to exclude */
	exclude: z.array(z.string()).optional(),
})

/**
 * Schema for sort specifications
 * Supports multiple sort fields with directions
 */
export const sortSpecSchema = z.object({
	/** Field name to sort by */
	field: z.string(),
	/** Sort direction */
	direction: z.enum(["asc", "desc"]).default("asc"),
})

/**
 * Schema for pagination parameters with proper validation
 */
export const paginationSchema = z.object({
	/** Page number (1-based) */
	page: z.coerce.number().int().positive().max(1000).default(1),
	/** Items per page */
	limit: z.coerce.number().int().positive().max(100).default(10),
	/** Offset for cursor-based pagination */
	offset: z.coerce.number().int().nonnegative().optional(),
})

/**
 * Enhanced query schema with full type safety
 * This is the main schema that combines all query parameter types
 * Designed for qs-compatible parsing with proper type coercion
 */
export const fullEnhancedQuerySchema = z.object({
	/** Field selection */
	fields: z.string().optional(),
	/** Page number for pagination */
	page: z.coerce.number().int().positive().max(1000).default(1),
	/** Items per page */
	limit: z.coerce.number().int().positive().max(100).default(10),
	/** Sorting specification */
	sort: z.union([z.string(), z.array(sortSpecSchema)]).optional(),
	/** Complex filtering with logical operators */
	filter: logicalFilterSchema.optional(),
	/** Search query */
	search: z.string().optional(),
})

/**
 * Schema for getOne route definition
 */
export const getOneQuerySchema = z.object({
	fields: z.string().optional(),
})

/**
 * Schema for validating individual filter field structures
 * Used to validate each field in a filter object
 */
export const filterFieldSchema = z.union([
	filterOperatorSchema,
	logicalFilterSchema,
	z.record(z.string(), z.union([filterOperatorSchema, logicalFilterSchema])),
])

/**
 * Schema for complete filter validation with nested structure support
 * This handles the full complexity of qs-parsed filter objects
 */
export const completeFilterSchema = z.record(z.string(), filterFieldSchema).optional()

/**
 * Schema for query parameter validation with enhanced error reporting
 * This is the recommended schema for most use cases
 */
export const validatedQuerySchema = z
	.object({
		/** Comma-separated list of fields to include in response */
		fields: z.string().optional(),
		/** Page number for pagination (1-based) */
		page: z.coerce.number().int().positive().max(1000).default(1),
		/** Number of items per page */
		limit: z.coerce.number().int().positive().max(100).default(10),
		/** Sort specification (e.g., "name:asc,createdAt:desc") */
		sort: z.string().optional(),
		/** Complex filter object with full validation */
		filter: completeFilterSchema,
		/** Search query string */
		search: z.string().max(500).optional(),
	})
	.strict() // Prevent unknown query parameters

/**
 * Type inference helpers
 */
export type EnhancedQuery = z.infer<typeof enhancedQuerySchema>
export type FilterOperator = z.infer<typeof filterOperatorSchema>
export type LogicalFilter = z.infer<typeof logicalFilterSchema>
export type FieldSelection = z.infer<typeof fieldSelectionSchema>
export type SortSpec = z.infer<typeof sortSpecSchema>
export type PaginationParams = z.infer<typeof paginationSchema>
export type FullEnhancedQuery = z.infer<typeof fullEnhancedQuerySchema>
export type FilterField = z.infer<typeof filterFieldSchema>
export type CompleteFilter = z.infer<typeof completeFilterSchema>
export type ValidatedQuery = z.infer<typeof validatedQuerySchema>
