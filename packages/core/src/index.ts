/**
 * Enhanced Query Parameter System
 *
 * This module provides a comprehensive query parameter parsing and validation system
 * built on top of the qs library for robust query string parsing and Zod for validation.
 *
 * Features:
 * - Nested object and array parsing
 * - Comprehensive error handling and validation
 * - Type-safe schemas with full TypeScript support
 * - Security measures against common attacks
 * - Performance optimizations with caching
 * - Backward compatibility with existing systems
 * - Extensive configuration options
 * - Parser → AST → Compiler architecture for ORM-agnostic query building
 *
 * @example
 * ```typescript
 * import { enhancedQuerySchema, EnhancedQueryParser } from './enhanced-query';
 *
 * const parser = new EnhancedQueryParser();
 * const result = parser.parse(queryString, enhancedQuerySchema);
 *
 * if (result.errors.length === 0) {
 *   // Use result.data safely
 *   console.log(result.data);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Using the new AST-based architecture
 * import { createQueryBuilder, createDrizzlePgCompiler, parse } from '@qbjs/core';
 *
 * // Parse query string to AST
 * const result = parse({ fields: 'id,name', page: '1', limit: '10' });
 *
 * // Or use the query builder factory
 * const builder = createQueryBuilder({
 *   config: { maxLimit: 50 },
 *   compiler: createDrizzlePgCompiler(),
 * });
 * const queryResult = builder.execute({ fields: 'id,name' }, usersTable);
 * ```
 */

// =============================================================================
// AST Types and Functions
// =============================================================================

// AST Factory Functions
export type { CreateQueryASTOptions } from "./ast/factory"
export {
	createFieldFilter,
	createLogicalFilter,
	createQueryAST,
	createSortSpec,
	DEFAULT_PAGINATION as AST_DEFAULT_PAGINATION,
} from "./ast/factory"
// AST Parser
export type { ParseError, ParserResult, ParseWarning, QueryInput } from "./ast/parser"
export {
	DEFAULT_PAGE,
	DEFAULT_PAGINATION,
	parse,
	parseFields,
	parseFilter,
	parseFromUrl,
	parsePagination,
	parseQueryString,
	parseSort,
} from "./ast/parser"
// AST Pretty Printer
export type { PrintedQuery } from "./ast/printer"
export { print, printFields, printFilter, printPagination, printQueryString, printSort } from "./ast/printer"
// AST Type Definitions
export type {
	FieldFilter,
	FilterNode,
	FilterOperator as ASTFilterOperator,
	LogicalFilter as ASTLogicalFilter,
	LogicalOperator,
	Pagination,
	QueryAST,
	SortDirection,
	SortSpec as ASTSortSpec,
} from "./ast/types"
export { FILTER_OPERATORS, isFieldFilter, isLogicalFilter, LOGICAL_OPERATORS, SORT_DIRECTIONS } from "./ast/types"

// =============================================================================
// Compiler Types and Functions
// =============================================================================

// Drizzle MySQL Compiler
export type { DrizzleMySqlQuery } from "./compiler/drizzle-mysql"
export {
	compileMySqlFields,
	compileMySqlFilter,
	compileMySqlPagination,
	compileMySqlSort,
	createDrizzleMySqlCompiler,
	DrizzleMySqlCompiler,
} from "./compiler/drizzle-mysql"
// Drizzle PostgreSQL Compiler
export type { DrizzlePgQuery } from "./compiler/drizzle-pg"
export {
	compileFields,
	compileFilter,
	compilePagination,
	compileSort,
	createDrizzlePgCompiler,
	DrizzlePgCompiler,
} from "./compiler/drizzle-pg"
// Drizzle SQLite Compiler
export type { DrizzleSQLiteQuery } from "./compiler/drizzle-sqlite"
export {
	compileSQLiteFields,
	compileSQLiteFilter,
	compileSQLitePagination,
	compileSQLiteSort,
	createDrizzleSQLiteCompiler,
	DrizzleSQLiteCompiler,
} from "./compiler/drizzle-sqlite"
// Compiler Types
export type {
	CompileError,
	CompileErrorCode,
	CompilerResult,
	CompileWarning,
	CompileWarningCode,
	QueryCompiler,
} from "./compiler/types"
export { createCompileError, createCompileWarning } from "./compiler/types"

// =============================================================================
// Security Configuration
// =============================================================================

// Security Types
export type { ResolvedSecurityConfig, SecurityConfig } from "./security/types"
export { DEFAULT_SECURITY_CONFIG, resolveSecurityConfig } from "./security/types"
// Security Validator
export type { SecurityError, SecurityValidationResult, SecurityWarning } from "./security/validator"
export {
	extractFilterFields,
	validateFields,
	validateFilterFields,
	validateLimit,
	validateOperators,
	validateSecurity,
	validateSortFields,
} from "./security/validator"

// =============================================================================
// Query Builder Factory
// =============================================================================

export type {
	CreateQueryBuilderOptions,
	QueryBuilder,
	QueryBuilderCompileResult,
	QueryBuilderError,
	QueryBuilderExecuteResult,
	QueryBuilderParseResult,
	QueryBuilderWarning,
} from "./builder/index"
export { createQueryBuilder } from "./builder/index"
// LRU Cache for query result caching
export type { CacheStats, EvictionReason, LRUCacheConfig } from "./cache"
export {
	createLRUCache,
	createQueryCache,
	DEFAULT_CACHE_CONFIG,
	getGlobalQueryCache,
	LRUCache,
	QueryCache,
	resetGlobalQueryCache,
} from "./cache"
// Error handling
export type {
	QueryError,
	QueryErrorCode,
	QueryErrorResponse,
	QueryWarning,
	QueryWarningCode,
} from "./errors"
export {
	createErrorResponse,
	createQueryError,
	createQueryWarning,
	ERROR_MESSAGES,
	WARNING_MESSAGES,
} from "./errors"
// Core types and interfaces
export type {
	CustomValidator,
	CustomValidatorDefinition,
	GlobalQueryConfig,
	OperatorHandler,
	PaginationResult,
	ParsedQuery,
	PopulateOptions,
	QueryParserConfig,
	QueryUtilsConfig,
	RouteQueryConfig,
} from "./types"
