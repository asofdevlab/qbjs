# @qbjs/client

[![npm version](https://img.shields.io/npm/v/@qbjs/client.svg)](https://www.npmjs.com/package/@qbjs/client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/asofdevlab/qbjs/actions/workflows/ci.yml/badge.svg)](https://github.com/asofdevlab/qbjs/actions/workflows/ci.yml)

A lightweight, zero-dependency client-side query builder for [@qbjs/core](https://www.npmjs.com/package/@qbjs/core). Build clean, type-safe filters, pagination, sorting, and search queries without boilerplate.

## Features

- **Zero Dependencies**: Lightweight and fast
- **Type-Safe**: Full TypeScript support with generics for field names
- **Immutable Builder**: Fluent API that never mutates state
- **React Query Ready**: Built-in query key generation for cache management
- **Bracket Notation**: Serializes to URL-compatible format for @qbjs/core

## Installation

```bash
# npm
npm install @qbjs/client

# pnpm
pnpm add @qbjs/client

# yarn
yarn add @qbjs/client
```

## Quick Start

```typescript
import { query, filter } from "@qbjs/client";

// Build a query with fluent API
const q = query()
  .page(1)
  .limit(10)
  .sort("createdAt", "desc")
  .fields("id", "name", "email")
  .where("status", "eq", "active");

// Get URL query string
const url = `/api/users?${q.toQueryString()}`;
// → /api/users?page=1&limit=10&sort=createdAt%3Adesc&fields=id%2Cname%2Cemail&filter[status][eq]=active
```

## API Reference

### QueryBuilder

The main class for building queries. Each method returns a new immutable instance.

#### Pagination

```typescript
query().page(2)           // Set page number
query().limit(25)         // Set items per page
query().paginate(2, 25)   // Set both at once
```

#### Sorting

```typescript
query().sort("name", "asc")   // Sort by field
query().sortAsc("name")       // Shorthand for ascending
query().sortDesc("createdAt") // Shorthand for descending

// Multiple sorts
query().sortDesc("createdAt").sortAsc("name")
// → sort=createdAt:desc,name:asc
```

#### Field Selection

```typescript
query().fields("id", "name", "email")
query().select("id", "name")  // Alias for fields()
```

#### Filtering

```typescript
// Simple where clause
query().where("status", "eq", "active")

// Using filter object
query().filter({ status: { eq: "active" } })

// Logical operators
query().and(
  { status: { eq: "active" } },
  { role: { eq: "admin" } }
)

query().or(
  { status: { eq: "active" } },
  { status: { eq: "pending" } }
)

query().not({ deleted: { eq: true } })
```

#### Output Methods

```typescript
const q = query().page(1).limit(10);

q.toQueryString()  // URL-encoded query string
q.build()          // SerializedQuery object
q.toParams()       // Raw QueryParams object
q.toQueryKey()     // Array for React Query cache keys
```

### Filter Helpers

Type-safe factory functions for all filter operators.

```typescript
import { filter, f } from "@qbjs/client";

// Equality
filter.eq("value")      // { eq: "value" }
filter.eqi("VALUE")     // { eqi: "VALUE" } (case-insensitive)
filter.ne("value")      // { ne: "value" }
filter.nei("VALUE")     // { nei: "VALUE" }

// Comparison
filter.lt(100)          // { lt: 100 }
filter.lte(100)         // { lte: 100 }
filter.gt(0)            // { gt: 0 }
filter.gte(0)           // { gte: 0 }

// Arrays
filter.in([1, 2, 3])    // { in: [1, 2, 3] }
filter.notIn([4, 5])    // { notIn: [4, 5] }

// Strings
filter.contains("test")      // { contains: "test" }
filter.containsi("TEST")     // { containsi: "TEST" }
filter.notContains("spam")   // { notContains: "spam" }
filter.startsWith("pre")     // { startsWith: "pre" }
filter.endsWith("fix")       // { endsWith: "fix" }

// Range
filter.between(10, 100)      // { between: [10, 100] }

// Null checks
filter.isNull()              // { null: true }
filter.isNotNull()           // { notNull: true }

// Logical combinators
filter.and(f1, f2, f3)       // { and: [f1, f2, f3] }
filter.or(f1, f2)            // { or: [f1, f2] }
filter.not(f1)               // { not: f1 }

// Short alias
f.eq("value")  // Same as filter.eq("value")
```

### Serialization Functions

```typescript
import { toQueryString, serialize, serializeFilter } from "@qbjs/client";

// Full query params to URL string
toQueryString({ page: 1, limit: 10, filter: { status: { eq: "active" } } })
// → "page=1&limit=10&filter[status][eq]=active"

// To object with string values
serialize({ page: 1, limit: 10 })
// → { page: "1", limit: "10" }

// Filter only
serializeFilter({ status: { eq: "active" } })
// → "filter[status][eq]=active"
```

### Pagination Helpers

```typescript
import { nextPage, prevPage, calculateOffset } from "@qbjs/client";

nextPage(3)           // → 4
prevPage(3)           // → 2
prevPage(1)           // → 1 (minimum)
calculateOffset(3, 10) // → 20
```

### Query Key Generation

Generate stable, deterministic keys for React Query or similar libraries.

```typescript
import { createQueryKey, query } from "@qbjs/client";

// From params
createQueryKey(["users", "list"], { page: 1, limit: 10 })
// → ["users", "list", { limit: 10, page: 1 }]

// From builder
query().page(1).limit(10).toQueryKey(["users", "list"])
// → ["users", "list", { limit: 10, page: 1 }]
```

### Print/Parse Utilities

```typescript
import { printQuery, parseQuery } from "@qbjs/client";

// Print for debugging
printQuery({ page: 1, sort: [{ field: "name", direction: "asc" }] })
// → "page=1&sort=name%3Aasc"

// Parse back to params
parseQuery("page=1&limit=10&sort=name:asc")
// → { page: 1, limit: 10, sort: [{ field: "name", direction: "asc" }] }
```

## Usage with React Query

```typescript
import { useQuery } from "@tanstack/react-query";
import { query, filter } from "@qbjs/client";

function useUsers(page: number, status?: string) {
  const q = query()
    .page(page)
    .limit(10)
    .sortDesc("createdAt");

  if (status) {
    q.where("status", "eq", status);
  }

  return useQuery({
    queryKey: q.toQueryKey(["users"]),
    queryFn: () => fetch(`/api/users?${q.toQueryString()}`).then(r => r.json()),
  });
}
```

## Type Safety

Use generics to constrain field names:

```typescript
type UserFields = "id" | "name" | "email" | "status" | "createdAt";

const q = query<UserFields>()
  .fields("id", "name")      // ✅ Valid
  .sort("createdAt", "desc") // ✅ Valid
  .where("status", "eq", "active"); // ✅ Valid

// TypeScript error: Argument of type '"invalid"' is not assignable
query<UserFields>().fields("invalid");
```

## Documentation

For comprehensive documentation, guides, and API reference:

**[📚 Full Documentation](https://qbjs.asof.dev)**

## Related Packages

- [@qbjs/core](https://www.npmjs.com/package/@qbjs/core) - Server-side query parser and compiler

## License

MIT © [Asofdev](https://github.com/asofdevlab)
