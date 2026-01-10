/**
 * Compiler Type Definitions for @qbjs/core
 *
 * This module defines the types for compilers that transform QueryAST
 * into ORM-specific query objects.
 *
 * @module compiler/types
 */

import type { QueryAST } from "../ast/types"

/**
 * Error codes for compilation errors.
 */
export type CompileErrorCode = "UNKNOWN_COLUMN" | "TYPE_MISMATCH" | "UNSUPPORTED_OPERATOR"

/**
 * Warning codes for compilation warnings.
 */
export type CompileWarningCode = "COLUMN_IGNORED" | "OPERATOR_FALLBACK" | "PERFORMANCE_HINT"

/**
 * An error that occurred during compilation.
 */
export interface CompileError {
	/** The error code */
	code: CompileErrorCode
	/** The field that caused the error */
	field: string
	/** Human-readable error message */
	message: string
}

/**
 * A warning that occurred during compilation.
 */
export interface CompileWarning {
	/** The warning code */
	code: CompileWarningCode
	/** The field that caused the warning */
	field: string
	/** Human-readable warning message */
	message: string
	/** Optional suggestion for fixing the issue */
	suggestion?: string
}

/**
 * Result of compiling a QueryAST to an ORM query.
 * @template T The type of the compiled query
 */
export interface CompilerResult<T> {
	/** The compiled query, or null if compilation failed */
	query: T | null
	/** Errors that occurred during compilation */
	errors: CompileError[]
	/** Warnings that occurred during compilation */
	warnings: CompileWarning[]
}

/**
 * Interface for query compilers that transform AST to ORM queries.
 * @template TTable The type of the table schema
 * @template TQuery The type of the compiled query
 */
export interface QueryCompiler<TTable, TQuery> {
	/**
	 * Compile a QueryAST into an ORM-specific query.
	 * @param ast The QueryAST to compile
	 * @param table The table schema to compile against
	 * @returns The compilation result with query, errors, and warnings
	 */
	compile(ast: QueryAST, table: TTable): CompilerResult<TQuery>
}

/**
 * Helper function to create a compile error.
 */
export function createCompileError(code: CompileErrorCode, field: string, message: string): CompileError {
	return { code, field, message }
}

/**
 * Helper function to create a compile warning.
 */
export function createCompileWarning(
	code: CompileWarningCode,
	field: string,
	message: string,
	suggestion?: string,
): CompileWarning {
	return { code, field, message, suggestion }
}
