import type { z } from "zod"

/**
 * Custom validator function type
 */
export type CustomValidator = (value: any, fieldName: string, context?: Record<string, any>) => boolean | string

/**
 * Custom validator with metadata
 */
export interface CustomValidatorDefinition {
	/** The validator function */
	validate: CustomValidator
	/** Human-readable description of what the validator checks */
	description?: string
	/** Error message to show when validation fails */
	errorMessage?: string
}

/**
 * Configuration options for the enhanced query parameter parser
 */
export interface QueryParserConfig {
	/** Maximum depth for nested objects (default: 5) */
	maxDepth?: number
	/** Maximum length for arrays (default: 20) */
	maxArrayLength?: number
	/** Maximum length for string values (default: 1000) */
	maxStringLength?: number
	/** Allow dot notation in addition to bracket notation (default: true) */
	allowDots?: boolean
	/** Allow prototype pollution (default: false for security) */
	allowPrototypes?: boolean
	/** Enable caching of parsed results (default: true) */
	cache?: boolean
	/** Enable debug logging (default: false) */
	debug?: boolean
}

/**
 * Configuration options for query utilities
 */
export interface QueryUtilsConfig {
	/** Maximum number of sort fields allowed (default: 5) */
	maxSortFields?: number
	/** Maximum depth for filter nesting (default: 3) */
	maxFilterDepth?: number
	/** List of allowed filter operators */
	allowedOperators?: string[]
	/** Custom operator implementations */
	customOperators?: Record<string, OperatorHandler>
	/** Custom validators for field values */
	customValidators?: Record<string, CustomValidatorDefinition>
	/** Enable input sanitization (default: true) */
	sanitizeInput?: boolean
}

/**
 * Options for field population
 */
export interface PopulateOptions {
	/** Fields that are allowed to be selected */
	allowedFields?: string[]
	/** Fields that must always be included */
	requiredFields?: string[]
	/** Maximum number of fields that can be selected */
	maxFields?: number
	/** Field aliases for transformation */
	fieldAliases?: Record<string, string>
	/** Field transformation functions */
	fieldTransformers?: Record<string, (value: any) => any>
}

/**
 * Pagination result with metadata
 */
export interface PaginationResult {
	/** Number of items per page */
	limit: number
	/** Number of items to skip */
	offset: number
	/** Current page number */
	page: number
	/** Total number of pages (if total count is available) */
	totalPages?: number
}

/**
 * Handler function for custom filter operators
 */
export type OperatorHandler = (value: any, columnRef: any) => any

/**
 * Result of query parsing with metadata and error information
 */
export interface ParsedQuery<T = any> {
	/** Successfully parsed data */
	data: T
	/** Validation or parsing errors */
	errors: any[] // Will be properly typed when errors module is imported
	/** Non-fatal warnings */
	warnings: any[] // Will be properly typed when errors module is imported
	/** Parsing metadata */
	metadata: {
		/** Time taken to parse in milliseconds */
		parseTime: number
		/** Complexity score of the query */
		complexity: number
	}
}

/**
 * Per-route configuration for query parsing
 */
export interface RouteQueryConfig {
	/** Parser-specific configuration */
	parser?: QueryParserConfig
	/** Query utilities configuration */
	utils?: QueryUtilsConfig
	/** Zod schema for validation */
	schema?: z.ZodSchema<any>
	/** Custom validator functions */
	customValidators?: Record<string, (value: any) => boolean>
}

/**
 * Global configuration for the query system
 */
export interface GlobalQueryConfig {
	/** Default limits for various parsing operations */
	defaultLimits: {
		maxDepth: number
		maxArrayLength: number
		maxStringLength: number
		maxSortFields: number
		maxFilterDepth: number
	}
	/** Security-related settings */
	security: {
		allowPrototypes: boolean
		sanitizeInput: boolean
		rateLimiting: boolean
	}
	/** Performance optimization settings */
	performance: {
		enableCaching: boolean
		cacheSize: number
		cacheTTL: number
	}
}
