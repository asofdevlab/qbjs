# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-01-09

### Added

- **Parser → AST → Compiler Architecture**: Clean separation of concerns with a well-defined Abstract Syntax Tree
  - `parse()` function to transform query strings into QueryAST
  - `print()` function to serialize QueryAST back to query strings
  - Round-trip consistency between parsing and printing
- **Query Builder Factory**: `createQueryBuilder()` for creating configured query builders with security and compiler options
- **Drizzle ORM Compilers**:
  - `createDrizzlePgCompiler()` for PostgreSQL
  - `createDrizzleMySqlCompiler()` for MySQL
  - `createDrizzleSQLiteCompiler()` for SQLite
- **Security Configuration**:
  - Field allowlisting with `allowedFields`
  - Operator restrictions with `allowedOperators`
  - Pagination limits with `maxLimit` and `defaultLimit`
- **Filter Operators**:
  - Comparison: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`
  - String: `contains`, `containsi`, `startsWith`, `endsWith`
  - Array: `in`, `notIn`
  - Null: `null`, `notNull`
  - Logical: `and`, `or`, `not`
- **Pagination**: Support for `page` and `limit` query parameters
- **Sorting**: Support for ascending and descending sort with `-` prefix for descending
- **Field Selection**: Support for `fields` parameter to select specific columns
- **Hono Middleware**: `createQueryParserMiddleware()` for Hono framework integration
- **LRU Cache**: Query result caching for improved performance
- **Backward Compatibility**: Migration utilities for legacy query formats
- **TypeScript Support**: Full type definitions with strict mode

[Unreleased]: https://github.com/asofdevlab/qbjs/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/asofdevlab/qbjs/releases/tag/v0.1.0
