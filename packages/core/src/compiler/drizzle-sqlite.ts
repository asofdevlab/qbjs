/**
 * Drizzle SQLite Compiler
 *
 * This module compiles QueryAST into Drizzle ORM queries for SQLite.
 * SQLite uses LOWER() function for case-insensitive operations instead of ilike.
 *
 * @module compiler/drizzle-sqlite
 */

import {
	and,
	asc,
	between,
	desc,
	eq,
	getTableColumns,
	gt,
	gte,
	inArray,
	isNotNull,
	isNull,
	like,
	lt,
	lte,
	ne,
	not,
	notInArray,
	notLike,
	or,
	sql,
} from "drizzle-orm"
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core"
import type { FilterNode, FilterOperator, QueryAST, SortSpec } from "../ast/types"
import { isFieldFilter, isLogicalFilter } from "../ast/types"
import type { CompileError, CompilerResult, CompileWarning, QueryCompiler } from "./types"
import { createCompileError, createCompileWarning } from "./types"

/**
 * Result of compiling a QueryAST for Drizzle SQLite.
 */
export interface DrizzleSQLiteQuery {
	/** Columns to select (undefined means all columns) */
	columns: Record<string, boolean> | undefined
	/** Limit for pagination */
	limit: number
	/** Offset for pagination */
	offset: number
	/** Order by clauses */
	orderBy: (ReturnType<typeof asc> | ReturnType<typeof desc>)[]
	/** Where clause */
	where: ReturnType<typeof and> | ReturnType<typeof eq> | undefined
}

/**
 * Compile fields from AST to Drizzle column selection.
 */
export function compileSQLiteFields(
	fields: string[] | null,
	table: SQLiteTable,
	errors: CompileError[],
	warnings: CompileWarning[],
): Record<string, boolean> | undefined {
	if (fields === null) {
		return undefined // Select all columns
	}

	const columns = getTableColumns(table)
	const columnNames = Object.keys(columns)
	const result: Record<string, boolean> = {}

	for (const field of fields) {
		if (columnNames.includes(field)) {
			result[field] = true
		} else {
			errors.push(createCompileError("UNKNOWN_COLUMN", field, `Column '${field}' does not exist in table schema`))
		}
	}

	// If all fields were invalid, return undefined to select all
	if (Object.keys(result).length === 0 && fields.length > 0) {
		warnings.push(
			createCompileWarning(
				"COLUMN_IGNORED",
				"fields",
				"All requested fields were invalid, selecting all columns",
				`Available columns: ${columnNames.join(", ")}`,
			),
		)
		return undefined
	}

	return result
}

/**
 * Compile pagination from AST to Drizzle limit/offset.
 */
export function compileSQLitePagination(pagination: QueryAST["pagination"]): { limit: number; offset: number } {
	return {
		limit: pagination.limit,
		offset: pagination.offset,
	}
}

/**
 * Compile sort specifications from AST to Drizzle orderBy clauses.
 */
export function compileSQLiteSort(
	sort: SortSpec[],
	table: SQLiteTable,
	errors: CompileError[],
): (ReturnType<typeof asc> | ReturnType<typeof desc>)[] {
	const columns = getTableColumns(table)
	const columnNames = Object.keys(columns)
	const orderBy: (ReturnType<typeof asc> | ReturnType<typeof desc>)[] = []

	for (const spec of sort) {
		if (!columnNames.includes(spec.field)) {
			errors.push(
				createCompileError("UNKNOWN_COLUMN", spec.field, `Sort column '${spec.field}' does not exist in table schema`),
			)
			continue
		}

		const column = columns[spec.field as keyof typeof columns] as SQLiteColumn
		orderBy.push(spec.direction === "desc" ? desc(column) : asc(column))
	}

	return orderBy
}

/**
 * Compile a single filter operator to a Drizzle condition.
 * SQLite uses LOWER() function for case-insensitive operations.
 */
function compileSQLiteOperator(
	column: SQLiteColumn,
	operator: FilterOperator,
	value: unknown,
	fieldName: string,
	errors: CompileError[],
): ReturnType<typeof eq> | null {
	switch (operator) {
		case "eq":
			return eq(column, value)
		case "eqi":
			// SQLite: Use LOWER() for case-insensitive equality
			return sql`LOWER(${column}) = LOWER(${String(value)})`
		case "ne":
			return ne(column, value)
		case "nei":
			// SQLite: Use LOWER() for case-insensitive inequality
			return sql`LOWER(${column}) != LOWER(${String(value)})`
		case "lt":
			return lt(column, value)
		case "lte":
			return lte(column, value)
		case "gt":
			return gt(column, value)
		case "gte":
			return gte(column, value)
		case "in":
			return inArray(column, Array.isArray(value) ? value : [value])
		case "notIn":
			return notInArray(column, Array.isArray(value) ? value : [value])
		case "contains":
			return like(column, `%${String(value)}%`)
		case "containsi":
			// SQLite: Use LOWER() for case-insensitive contains
			return sql`LOWER(${column}) LIKE LOWER(${`%${String(value)}%`})`
		case "notContains":
			return notLike(column, `%${String(value)}%`)
		case "notContainsi":
			// SQLite: Use LOWER() for case-insensitive not contains
			return sql`LOWER(${column}) NOT LIKE LOWER(${`%${String(value)}%`})`
		case "startsWith":
			return like(column, `${String(value)}%`)
		case "endsWith":
			return like(column, `%${String(value)}`)
		case "null":
			return isNull(column)
		case "notNull":
			return isNotNull(column)
		case "between":
			if (!Array.isArray(value) || value.length !== 2) {
				errors.push(
					createCompileError(
						"TYPE_MISMATCH",
						fieldName,
						`Operator 'between' requires array with exactly 2 values, got ${typeof value}`,
					),
				)
				return null
			}
			return between(column, value[0], value[1])
		default:
			errors.push(createCompileError("UNSUPPORTED_OPERATOR", fieldName, `Unsupported operator '${operator}'`))
			return null
	}
}

/**
 * Compile a filter node from AST to Drizzle where clause.
 */
export function compileSQLiteFilter(
	filter: FilterNode | null,
	table: SQLiteTable,
	errors: CompileError[],
): ReturnType<typeof and> | ReturnType<typeof eq> | undefined {
	if (filter === null) {
		return undefined
	}

	const columns = getTableColumns(table)
	const columnNames = Object.keys(columns)

	function compileNode(node: FilterNode): ReturnType<typeof eq> | null {
		if (isFieldFilter(node)) {
			// Check if column exists
			if (!columnNames.includes(node.field)) {
				errors.push(
					createCompileError(
						"UNKNOWN_COLUMN",
						node.field,
						`Filter column '${node.field}' does not exist in table schema`,
					),
				)
				return null
			}

			const column = columns[node.field as keyof typeof columns] as SQLiteColumn
			return compileSQLiteOperator(column, node.operator, node.value, node.field, errors)
		}

		if (isLogicalFilter(node)) {
			const compiledConditions = node.conditions.map(compileNode).filter((c): c is NonNullable<typeof c> => c !== null)

			if (compiledConditions.length === 0) {
				return null
			}

			switch (node.operator) {
				case "and": {
					if (compiledConditions.length === 1) {
						return compiledConditions[0]!
					}
					const result = and(...compiledConditions)
					return result ?? null
				}
				case "or": {
					if (compiledConditions.length === 1) {
						return compiledConditions[0]!
					}
					const result = or(...compiledConditions)
					return result ?? null
				}
				case "not":
					// NOT applies to the first condition only
					return compiledConditions[0] ? not(compiledConditions[0]) : null
				default:
					return null
			}
		}

		return null
	}

	const result = compileNode(filter)
	return result ?? undefined
}

/**
 * Drizzle SQLite Query Compiler.
 *
 * Compiles QueryAST into Drizzle ORM queries optimized for SQLite.
 * Uses LOWER() function for case-insensitive operations instead of ilike.
 */
export class DrizzleSQLiteCompiler implements QueryCompiler<SQLiteTable, DrizzleSQLiteQuery> {
	/**
	 * Compile a QueryAST into a Drizzle SQLite query.
	 */
	compile(ast: QueryAST, table: SQLiteTable): CompilerResult<DrizzleSQLiteQuery> {
		const errors: CompileError[] = []
		const warnings: CompileWarning[] = []

		const columns = compileSQLiteFields(ast.fields, table, errors, warnings)
		const { limit, offset } = compileSQLitePagination(ast.pagination)
		const orderBy = compileSQLiteSort(ast.sort, table, errors)
		const where = compileSQLiteFilter(ast.filter, table, errors)

		// If there are errors, still return the query but with errors
		const query: DrizzleSQLiteQuery = {
			columns,
			limit,
			offset,
			orderBy,
			where,
		}

		return {
			query,
			errors,
			warnings,
		}
	}
}

/**
 * Create a new Drizzle SQLite compiler instance.
 */
export function createDrizzleSQLiteCompiler(): DrizzleSQLiteCompiler {
	return new DrizzleSQLiteCompiler()
}
