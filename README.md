# qbjs - ORM-Agnostic Query Builder

[![npm version](https://img.shields.io/npm/v/@qbjs/core.svg)](https://www.npmjs.com/package/@qbjs/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/asofdevlab/qbjs/actions/workflows/ci.yml/badge.svg)](https://github.com/asofdevlab/qbjs/actions/workflows/ci.yml)

An ORM-agnostic query builder for building type-safe queries from API request query strings.

## Features

- **Parser → AST → Compiler Architecture**: Clean separation of concerns with a well-defined Abstract Syntax Tree
- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **ORM-Agnostic**: Works with Drizzle ORM (PostgreSQL, MySQL, SQLite) with extensible compiler system
- **Security-First**: Built-in security configuration for field allowlisting, operator restrictions, and limit enforcement
- **Framework Integration**: First-class support for Hono with middleware included
- **Flexible Filtering**: Support for comparison, string, and logical operators
- **Pagination & Sorting**: Built-in support for pagination and multi-field sorting
- **Field Selection**: Select only the fields you need
- **Caching**: LRU cache for parsed queries to improve performance
- **Backward Compatible**: Migration utilities for legacy query formats

## Installation

```bash
# npm
npm install @qbjs/core

# pnpm
pnpm add @qbjs/core

# yarn
yarn add @qbjs/core
```

### Peer Dependencies

qbjs works with the following peer dependencies:

```bash
npm install zod

# For Drizzle ORM
npm install drizzle-orm
```

## Quick Start

Here's a minimal example using Hono and Drizzle with PostgreSQL:

```typescript
import { Hono } from "hono";
import { createQueryBuilder, createDrizzlePgCompiler } from "@qbjs/core";
import { db } from "./db";
import { users } from "./db/schema";

const app = new Hono();

// Create a query builder with security configuration
const queryBuilder = createQueryBuilder({
  config: {
    allowedFields: ["id", "name", "email", "createdAt"],
    maxLimit: 100,
    defaultLimit: 10,
  },
  compiler: createDrizzlePgCompiler(),
});

app.get("/users", async (c) => {
  // Parse query string and compile to Drizzle query
  const result = queryBuilder.executeFromUrl(c.req.url, users);

  if (result.errors.length > 0) {
    return c.json({ errors: result.errors }, 400);
  }

  // Execute the compiled query
  const data = await db.query.users.findMany({
    where: result.query?.where,
    columns: result.query?.columns,
    limit: result.query?.limit,
    offset: result.query?.offset,
    orderBy: result.query?.orderBy,
  });

  return c.json(data);
});

export default app;
```

### Example Query Strings

```
# Filter by field
GET /users?filter[status][eq]=active

# Multiple filters with logical operators
GET /users?filter[and][0][age][gte]=18&filter[and][1][status][eq]=active

# Pagination
GET /users?page=1&limit=20

# Sorting (ascending)
GET /users?sort=createdAt

# Sorting (descending)
GET /users?sort=-createdAt

# Field selection
GET /users?fields=id,name,email

# Combined
GET /users?fields=id,name&filter[status][eq]=active&sort=-createdAt&page=1&limit=10
```

## API Overview

### Core Functions

| Function | Description |
|----------|-------------|
| `createQueryBuilder()` | Factory function to create a configured query builder |
| `parse()` | Parse query parameters into a QueryAST |
| `createDrizzlePgCompiler()` | Create a PostgreSQL compiler for Drizzle ORM |
| `createDrizzleMySqlCompiler()` | Create a MySQL compiler for Drizzle ORM |
| `createDrizzleSQLiteCompiler()` | Create a SQLite compiler for Drizzle ORM |

### Security Configuration

```typescript
const queryBuilder = createQueryBuilder({
  config: {
    allowedFields: ["id", "name", "email"],  // Restrict queryable fields
    allowedOperators: ["eq", "ne", "gt", "lt"], // Restrict filter operators
    maxLimit: 100,  // Maximum items per page
    defaultLimit: 20,  // Default items per page
  },
  compiler: createDrizzlePgCompiler(),
});
```

### Types

| Type | Description |
|------|-------------|
| `QueryAST` | The Abstract Syntax Tree representing a parsed query |
| `QueryBuilder` | The main query builder interface |
| `SecurityConfig` | Configuration for security restrictions |
| `FilterNode` | Union type for filter expressions |

## Documentation

For comprehensive documentation, guides, and API reference, visit our [documentation site](https://qbjs.asof.dev).

- [Getting Started](https://qbjs.asof.dev/docs/getting-started)
- [Core Concepts](https://qbjs.asof.dev/docs/core-concepts)
- [Guides](https://qbjs.asof.dev/docs/guides)
- [API Reference](https://qbjs.asof.dev/docs/api-reference)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Setting up the development environment
- Project structure
- Coding standards
- Pull request process

## License

MIT © [Asofdev](https://github.com/asofdevlab)
