/**
 * Query Builder Factory for @qbjs/core
 *
 * This module provides a factory function to create configured query builders
 * that wire together the parser, security validator, and compiler.
 *
 * @module builder
 */

import {
	type ParseError,
	type ParserResult,
	type ParseWarning,
	parse,
	parseFromUrl,
	type QueryInput,
} from "../ast/parser";
import type { QueryAST } from "../ast/types";
import type { CompileError, CompilerResult, CompileWarning, QueryCompiler } from "../compiler/types";
import type { SecurityConfig } from "../security/types";
import { resolveSecurityConfig } from "../security/types";
import { type SecurityError, type SecurityWarning, validateSecurity } from "../security/validator";

/**
 * Combined error type for query builder operations.
 * Includes both parse errors and security errors.
 */
export type QueryBuilderError = ParseError | SecurityError | CompileError;

/**
 * Combined warning type for query builder operations.
 * Includes both parse warnings and security warnings.
 */
export type QueryBuilderWarning = ParseWarning | SecurityWarning | CompileWarning;

/**
 * Result of parsing a query through the query builder.
 */
export interface QueryBuilderParseResult {
	/** The parsed and validated AST, or null if parsing/validation failed */
	ast: QueryAST | null;
	/** All errors from parsing and security validation */
	errors: QueryBuilderError[];
	/** All warnings from parsing and security validation */
	warnings: QueryBuilderWarning[];
}

/**
 * Result of compiling a query through the query builder.
 */
export interface QueryBuilderCompileResult<TQuery> {
	/** The compiled query, or null if compilation failed */
	query: TQuery | null;
	/** All errors from compilation */
	errors: CompileError[];
	/** All warnings from compilation */
	warnings: CompileWarning[];
}

/**
 * Result of executing a full query (parse + compile) through the query builder.
 */
export interface QueryBuilderExecuteResult<TQuery> {
	/** The compiled query, or null if any step failed */
	query: TQuery | null;
	/** The intermediate AST, or null if parsing failed */
	ast: QueryAST | null;
	/** All errors from parsing, validation, and compilation */
	errors: QueryBuilderError[];
	/** All warnings from parsing, validation, and compilation */
	warnings: QueryBuilderWarning[];
}

/**
 * Query builder interface that orchestrates parsing, validation, and compilation.
 * @template TTable The type of the table schema
 * @template TQuery The type of the compiled query
 */
export interface QueryBuilder<TTable, TQuery> {
	/**
	 * Parse a query input into a validated AST.
	 * Applies security constraints during parsing.
	 *
	 * @param input - Query input object with fields, page, limit, sort, and filter
	 * @returns Parse result with AST, errors, and warnings
	 */
	parse(input: QueryInput): QueryBuilderParseResult;

	/**
	 * Parse a URL's query string into a validated AST.
	 * Uses the qs library to parse bracket notation filters.
	 *
	 * @param url - Full URL string with query parameters
	 * @returns Parse result with AST, errors, and warnings
	 */
	parseFromUrl(url: string): QueryBuilderParseResult;

	/**
	 * Compile a validated AST into an ORM-specific query.
	 *
	 * @param ast - The QueryAST to compile
	 * @param table - The table schema to compile against
	 * @returns Compile result with query, errors, and warnings
	 */
	compile(ast: QueryAST, table: TTable): QueryBuilderCompileResult<TQuery>;

	/**
	 * Execute a full query: parse, validate, and compile in one step.
	 *
	 * @param input - Query input object with fields, page, limit, sort, and filter
	 * @param table - The table schema to compile against
	 * @returns Execute result with query, AST, errors, and warnings
	 */
	execute(input: QueryInput, table: TTable): QueryBuilderExecuteResult<TQuery>;

	/**
	 * Execute a full query from a URL: parse, validate, and compile in one step.
	 * Uses the qs library to parse bracket notation filters from the URL.
	 *
	 * @param url - Full URL string with query parameters
	 * @param table - The table schema to compile against
	 * @returns Execute result with query, AST, errors, and warnings
	 *
	 * @example
	 * const result = builder.executeFromUrl(
	 *   "http://localhost:8787/api/posts?filter[title][containsi]=typescript&page=1&limit=10",
	 *   postsTable
	 * );
	 */
	executeFromUrl(url: string, table: TTable): QueryBuilderExecuteResult<TQuery>;

	/**
	 * Get the resolved security configuration.
	 */
	getSecurityConfig(): SecurityConfig;
}

/**
 * Options for creating a query builder.
 * @template TTable The type of the table schema
 * @template TQuery The type of the compiled query
 */
export interface CreateQueryBuilderOptions<TTable, TQuery> {
	/** Security configuration for query validation */
	config?: SecurityConfig;
	/** The compiler to use for transforming AST to ORM queries */
	compiler: QueryCompiler<TTable, TQuery>;
}

/**
 * Create a configured query builder instance.
 *
 * The query builder wires together the parser, security validator, and compiler
 * to provide a unified interface for query processing.
 *
 * @template TTable The type of the table schema
 * @template TQuery The type of the compiled query
 * @param options - Configuration options including security config and compiler
 * @returns A configured QueryBuilder instance
 *
 * @example
 * ```typescript
 * import { createQueryBuilder } from '@qbjs/core/builder';
 * import { createDrizzlePgCompiler } from '@qbjs/core/compiler';
 *
 * const compiler = createDrizzlePgCompiler();
 * const builder = createQueryBuilder({
 *   config: {
 *     allowedFields: ['id', 'name', 'email'],
 *     maxLimit: 50,
 *   },
 *   compiler,
 * });
 *
 * // Parse only
 * const parseResult = builder.parse({
 *   fields: 'id,name',
 *   page: '1',
 *   limit: '10',
 * });
 *
 * // Compile only
 * const compileResult = builder.compile(parseResult.ast!, usersTable);
 *
 * // Or execute both in one step
 * const result = builder.execute({
 *   fields: 'id,name',
 *   filter: { status: { eq: 'active' } },
 * }, usersTable);
 * ```
 */
export function createQueryBuilder<TTable, TQuery>(
	options: CreateQueryBuilderOptions<TTable, TQuery>,
): QueryBuilder<TTable, TQuery> {
	const resolvedConfig = resolveSecurityConfig(options.config);
	const compiler = options.compiler;

	function parseInternal(parserResult: ParserResult): QueryBuilderParseResult {
		const errors: QueryBuilderError[] = [];
		const warnings: QueryBuilderWarning[] = [];

		// Collect parse errors and warnings
		errors.push(...parserResult.errors);
		warnings.push(...parserResult.warnings);

		// If parsing failed, return early
		if (!parserResult.ast) {
			return {
				ast: null,
				errors,
				warnings,
			};
		}

		// Validate against security config
		const securityResult = validateSecurity(parserResult.ast, resolvedConfig);

		// Collect security errors and warnings
		errors.push(...securityResult.errors);
		warnings.push(...securityResult.warnings);

		// If security validation failed, return null AST
		if (!securityResult.valid) {
			return {
				ast: null,
				errors,
				warnings,
			};
		}

		// Return the potentially modified AST (e.g., with capped limit)
		return {
			ast: securityResult.ast,
			errors,
			warnings,
		};
	}

	return {
		parse(input: QueryInput): QueryBuilderParseResult {
			const parserResult: ParserResult = parse(input);
			return parseInternal(parserResult);
		},

		parseFromUrl(url: string): QueryBuilderParseResult {
			const parserResult: ParserResult = parseFromUrl(url);
			return parseInternal(parserResult);
		},

		compile(ast: QueryAST, table: TTable): QueryBuilderCompileResult<TQuery> {
			const compileResult: CompilerResult<TQuery> = compiler.compile(ast, table);

			return {
				query: compileResult.query,
				errors: compileResult.errors,
				warnings: compileResult.warnings,
			};
		},

		execute(input: QueryInput, table: TTable): QueryBuilderExecuteResult<TQuery> {
			const errors: QueryBuilderError[] = [];
			const warnings: QueryBuilderWarning[] = [];

			// Step 1: Parse and validate
			const parseResult = this.parse(input);

			// Collect parse/validation errors and warnings
			errors.push(...parseResult.errors);
			warnings.push(...parseResult.warnings);

			// If parsing/validation failed, return early
			if (!parseResult.ast) {
				return {
					query: null,
					ast: null,
					errors,
					warnings,
				};
			}

			// Step 2: Compile
			const compileResult = this.compile(parseResult.ast, table);

			// Collect compile errors and warnings
			errors.push(...compileResult.errors);
			warnings.push(...compileResult.warnings);

			return {
				query: compileResult.query,
				ast: parseResult.ast,
				errors,
				warnings,
			};
		},

		executeFromUrl(url: string, table: TTable): QueryBuilderExecuteResult<TQuery> {
			const errors: QueryBuilderError[] = [];
			const warnings: QueryBuilderWarning[] = [];

			// Step 1: Parse and validate from URL
			const parseResult = this.parseFromUrl(url);

			// Collect parse/validation errors and warnings
			errors.push(...parseResult.errors);
			warnings.push(...parseResult.warnings);

			// If parsing/validation failed, return early
			if (!parseResult.ast) {
				return {
					query: null,
					ast: null,
					errors,
					warnings,
				};
			}

			// Step 2: Compile
			const compileResult = this.compile(parseResult.ast, table);

			// Collect compile errors and warnings
			errors.push(...compileResult.errors);
			warnings.push(...compileResult.warnings);

			return {
				query: compileResult.query,
				ast: parseResult.ast,
				errors,
				warnings,
			};
		},

		getSecurityConfig(): SecurityConfig {
			return { ...resolvedConfig };
		},
	};
}

// Re-export types for convenience
export type { QueryInput } from "../ast/parser";
export type { QueryAST } from "../ast/types";
export type { CompilerResult, QueryCompiler } from "../compiler/types";
export type { SecurityConfig } from "../security/types";
