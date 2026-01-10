/**
 * Unit tests for Query Builder Factory
 *
 * Tests the query builder's parse, compile, and execute methods.
 * **Validates: Requirements 8.1, 8.2, 8.3**
 */

import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"
import type { QueryAST } from "../ast/types"
import { createDrizzlePgCompiler } from "../compiler/drizzle-pg"
import { createQueryBuilder } from "./index"

// Test table schema
const usersTable = pgTable("users", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email"),
	age: integer("age"),
	active: boolean("active"),
	createdAt: timestamp("created_at").defaultNow(),
})

describe("Query Builder Factory", () => {
	const compiler = createDrizzlePgCompiler()

	describe("createQueryBuilder", () => {
		it("should create a query builder instance with default config", () => {
			const builder = createQueryBuilder({
				compiler,
			})

			expect(builder).toBeDefined()
			expect(builder.parse).toBeInstanceOf(Function)
			expect(builder.compile).toBeInstanceOf(Function)
			expect(builder.execute).toBeInstanceOf(Function)
			expect(builder.getSecurityConfig).toBeInstanceOf(Function)
		})

		it("should create a query builder instance with custom config", () => {
			const builder = createQueryBuilder({
				config: {
					allowedFields: ["id", "name", "email"],
					maxLimit: 50,
				},
				compiler,
			})

			const config = builder.getSecurityConfig()
			expect(config.allowedFields).toEqual(["id", "name", "email"])
			expect(config.maxLimit).toBe(50)
		})
	})

	describe("parse method", () => {
		/**
		 * Test parse method returns valid AST
		 * **Validates: Requirements 8.2**
		 */
		it("should parse valid input and return AST", () => {
			const builder = createQueryBuilder({ compiler })

			const result = builder.parse({
				fields: "id,name,email",
				page: "1",
				limit: "10",
				sort: "createdAt:desc",
			})

			expect(result.ast).not.toBeNull()
			expect(result.ast!.fields).toEqual(["id", "name", "email"])
			expect(result.ast!.pagination).toEqual({ offset: 0, limit: 10 })
			expect(result.ast!.sort).toEqual([{ field: "createdAt", direction: "desc" }])
			expect(result.errors).toHaveLength(0)
		})

		it("should parse input with filters", () => {
			const builder = createQueryBuilder({ compiler })

			const result = builder.parse({
				fields: "id,name",
				filter: { status: { eq: "active" } },
			})

			expect(result.ast).not.toBeNull()
			expect(result.ast!.filter).not.toBeNull()
			expect(result.ast!.filter!.type).toBe("field")
		})

		it("should apply security validation during parse", () => {
			const builder = createQueryBuilder({
				config: {
					allowedFields: ["id", "name"],
				},
				compiler,
			})

			const result = builder.parse({
				fields: "id,name,email", // email is not allowed
			})

			expect(result.ast).toBeNull()
			expect(result.errors.length).toBeGreaterThan(0)
			expect(result.errors.some((e) => e.code === "FIELD_NOT_ALLOWED")).toBe(true)
		})

		it("should cap limit to maxLimit", () => {
			const builder = createQueryBuilder({
				config: {
					maxLimit: 50,
				},
				compiler,
			})

			const result = builder.parse({
				limit: "100", // exceeds maxLimit
			})

			expect(result.ast).not.toBeNull()
			expect(result.ast!.pagination.limit).toBe(50)
			expect(result.warnings.some((w) => w.code === "LIMIT_CAPPED")).toBe(true)
		})

		it("should reject disallowed operators", () => {
			const builder = createQueryBuilder({
				config: {
					operators: ["eq", "ne"], // only eq and ne allowed
				},
				compiler,
			})

			const result = builder.parse({
				filter: { name: { contains: "test" } }, // contains not allowed
			})

			expect(result.ast).toBeNull()
			expect(result.errors.some((e) => e.code === "OPERATOR_NOT_ALLOWED")).toBe(true)
		})

		it("should return parse errors for invalid input", () => {
			const builder = createQueryBuilder({ compiler })

			const result = builder.parse({
				filter: { name: { invalidOp: "test" } }, // invalid operator
			})

			expect(result.errors.length).toBeGreaterThan(0)
		})
	})

	describe("compile method", () => {
		/**
		 * Test compile method returns valid query
		 * **Validates: Requirements 8.3**
		 */
		it("should compile valid AST to Drizzle query", () => {
			const builder = createQueryBuilder({ compiler })

			const ast: QueryAST = {
				fields: ["id", "name", "email"],
				pagination: { offset: 0, limit: 10 },
				sort: [{ field: "createdAt", direction: "desc" }],
				filter: null,
			}

			const result = builder.compile(ast, usersTable)

			expect(result.query).not.toBeNull()
			expect(result.query!.columns).toEqual({
				id: true,
				name: true,
				email: true,
			})
			expect(result.query!.limit).toBe(10)
			expect(result.query!.offset).toBe(0)
			expect(result.query!.orderBy.length).toBe(1)
			expect(result.errors).toHaveLength(0)
		})

		it("should compile AST with filters", () => {
			const builder = createQueryBuilder({ compiler })

			const ast: QueryAST = {
				fields: null,
				pagination: { offset: 0, limit: 10 },
				sort: [],
				filter: {
					type: "field",
					field: "name",
					operator: "eq",
					value: "John",
				},
			}

			const result = builder.compile(ast, usersTable)

			expect(result.query).not.toBeNull()
			expect(result.query!.where).toBeDefined()
			expect(result.errors).toHaveLength(0)
		})

		it("should return compile errors for invalid columns", () => {
			const builder = createQueryBuilder({ compiler })

			const ast: QueryAST = {
				fields: ["invalidColumn"],
				pagination: { offset: 0, limit: 10 },
				sort: [],
				filter: null,
			}

			const result = builder.compile(ast, usersTable)

			expect(result.errors.length).toBeGreaterThan(0)
			expect(result.errors.some((e) => e.code === "UNKNOWN_COLUMN")).toBe(true)
		})
	})

	describe("execute method", () => {
		/**
		 * Test execute method combines parse and compile
		 * **Validates: Requirements 8.1, 8.2, 8.3**
		 */
		it("should execute full query pipeline", () => {
			const builder = createQueryBuilder({ compiler })

			const result = builder.execute(
				{
					fields: "id,name,email",
					page: "2",
					limit: "10",
					sort: "name:asc",
				},
				usersTable,
			)

			expect(result.query).not.toBeNull()
			expect(result.ast).not.toBeNull()
			expect(result.ast!.fields).toEqual(["id", "name", "email"])
			expect(result.ast!.pagination).toEqual({ offset: 10, limit: 10 })
			expect(result.query!.columns).toEqual({
				id: true,
				name: true,
				email: true,
			})
			expect(result.query!.limit).toBe(10)
			expect(result.query!.offset).toBe(10)
			expect(result.errors).toHaveLength(0)
		})

		it("should execute with filters", () => {
			const builder = createQueryBuilder({ compiler })

			const result = builder.execute(
				{
					filter: { active: { eq: true } },
				},
				usersTable,
			)

			expect(result.query).not.toBeNull()
			expect(result.query!.where).toBeDefined()
			expect(result.errors).toHaveLength(0)
		})

		it("should return null query when parse fails", () => {
			const builder = createQueryBuilder({
				config: {
					allowedFields: ["id"],
				},
				compiler,
			})

			const result = builder.execute(
				{
					fields: "id,name", // name not allowed
				},
				usersTable,
			)

			expect(result.query).toBeNull()
			expect(result.ast).toBeNull()
			expect(result.errors.length).toBeGreaterThan(0)
		})

		it("should return errors when compile encounters invalid columns", () => {
			const builder = createQueryBuilder({ compiler })

			const result = builder.execute(
				{
					fields: "invalidColumn",
				},
				usersTable,
			)

			// Compiler returns query with errors (doesn't return null)
			expect(result.ast).not.toBeNull() // AST is valid
			expect(result.errors.some((e) => e.code === "UNKNOWN_COLUMN")).toBe(true)
		})

		it("should apply security constraints during execute", () => {
			const builder = createQueryBuilder({
				config: {
					maxLimit: 25,
					operators: ["eq", "ne", "lt", "gt"],
				},
				compiler,
			})

			const result = builder.execute(
				{
					limit: "100",
					filter: { age: { gt: 18 } },
				},
				usersTable,
			)

			expect(result.query).not.toBeNull()
			expect(result.ast!.pagination.limit).toBe(25) // capped
			expect(result.warnings.some((w) => w.code === "LIMIT_CAPPED")).toBe(true)
		})

		it("should collect all errors and warnings from all stages", () => {
			const builder = createQueryBuilder({
				config: {
					maxLimit: 10,
				},
				compiler,
			})

			const result = builder.execute(
				{
					limit: "100", // will be capped (warning)
					fields: "id,name",
				},
				usersTable,
			)

			// Should have limit capped warning
			expect(result.warnings.some((w) => w.code === "LIMIT_CAPPED")).toBe(true)
		})
	})

	describe("getSecurityConfig", () => {
		it("should return the resolved security config", () => {
			const builder = createQueryBuilder({
				config: {
					allowedFields: ["id", "name"],
					maxLimit: 100,
				},
				compiler,
			})

			const config = builder.getSecurityConfig()

			expect(config.allowedFields).toEqual(["id", "name"])
			expect(config.maxLimit).toBe(100)
		})

		it("should return default config when none provided", () => {
			const builder = createQueryBuilder({ compiler })

			const config = builder.getSecurityConfig()

			expect(config.allowedFields).toEqual([])
			expect(config.maxLimit).toBe(100)
			expect(config.defaultLimit).toBe(10)
		})
	})
})
