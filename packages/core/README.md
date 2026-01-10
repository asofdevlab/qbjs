# @qbjs/core

[![npm version](https://img.shields.io/npm/v/@qbjs/core.svg)](https://www.npmjs.com/package/@qbjs/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/asofdevlab/qbjs/actions/workflows/ci.yml/badge.svg)](https://github.com/asofdevlab/qbjs/actions/workflows/ci.yml)

An ORM-agnostic query builder for building type-safe queries from API request query strings.

## Features

- **Parser → AST → Compiler Architecture**: Clean separation of concerns with a well-defined Abstract Syntax Tree
- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **ORM-Agnostic**: Works with Drizzle ORM (PostgreSQL, MySQL, SQLite)
- **Security-First**: Built-in security configuration for field allowlisting and operator restrictions
- **Framework Integration**: First-class support for Hono with middleware included
- **Flexible Filtering**: Support for comparison, string, and logical operators
- **Pagination & Sorting**: Built-in support for pagination and multi-field sorting

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

```bash
npm install zod
```

### Optional Dependencies
```bash
npm install drizzle-orm
```

## Quick Start

```typescript
import { Hono } from "hono";
import { createQueryBuilder, createDrizzlePgCompiler } from "@qbjs/core";
import { db } from "./db";
import { users } from "./db/schema";

const app = new Hono();

const queryBuilder = createQueryBuilder({
  config: {
    allowedFields: ["id", "name", "email", "createdAt"],
    maxLimit: 100,
    defaultLimit: 10,
  },
  compiler: createDrizzlePgCompiler(),
});

app.get("/users", async (c) => {
  const result = queryBuilder.executeFromUrl(c.req.url, users);

  if (result.errors.length > 0) {
    return c.json({ errors: result.errors }, 400);
  }

  const data = await db.query.users.findMany({
    where: result.query?.where,
    columns: result.query?.columns,
    limit: result.query?.limit,
    offset: result.query?.offset,
    orderBy: result.query?.orderBy,
  });

  return c.json(data);
});
```

### Example Query Strings

```
GET /users?filter[status][eq]=active
GET /users?sort=-createdAt&page=1&limit=10
GET /users?fields=id,name,email
```

## Documentation

For comprehensive documentation, guides, and API reference:

**[📚 Full Documentation](https://qbjs.dev)**

- [Getting Started](https://qbjs.dev/docs/getting-started)
- [Core Concepts](https://qbjs.dev/docs/core-concepts)
- [API Reference](https://qbjs.dev/docs/api-reference)

## License

MIT © [Asofdev](https://github.com/asofdevlab)
