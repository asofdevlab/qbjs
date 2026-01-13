# Next.js + @qbjs/client Integration Example

This example demonstrates how to use `@qbjs/client` with Next.js and React Query for building type-safe, fluent API queries.

## Features Demonstrated

### 1. Fluent QueryBuilder API

Build queries using a chainable, immutable API:

```typescript
import { query } from "@qbjs/client"

const params = query()
  .paginate(1, 10)
  .sortDesc("createdAt")
  .fields("id", "title", "slug", "createdAt")
  .filter({ published: f.eq(true) })
  .toParams()
```

### 2. Type-Safe Filter Helpers

Use the `f` helper object for building filters with full TypeScript support:

```typescript
import { f } from "@qbjs/client"

// Simple equality
{ status: f.eq("active") }

// Comparison operators
{ age: f.gte(18) }
{ price: f.between(10, 100) }

// String operators
{ title: f.contains("typescript") }
{ email: f.endsWith("@example.com") }

// Array operators
{ category: f.in(["tech", "news"]) }

// Logical combinations
f.and(
  { published: f.eq(true) },
  f.or(
    { featured: f.eq(true) },
    { views: f.gte(1000) }
  )
)
```

### 3. Pagination Helpers

Navigate through paginated results easily:

```typescript
import { nextPage, prevPage, calculateOffset } from "@qbjs/client"

const currentPage = 5
const next = nextPage(currentPage)     // 6
const prev = prevPage(currentPage)     // 4
const offset = calculateOffset(5, 10)  // 40
```

### 4. Query Key Generation for React Query

Generate stable, deterministic query keys:

```typescript
import { createQueryKey } from "@qbjs/client"

const queryKey = createQueryKey(["posts", "list"], params)
// Same params always produce identical keys
```

### 5. Search Queries

Build search queries with required search term:

```typescript
import { buildSearchQuery } from "@qbjs/client"

const searchQuery = buildSearchQuery({
  q: "typescript",
  page: 1,
  limit: 10,
  sort: [{ field: "relevance", direction: "desc" }]
})
```

## Project Structure

```
integrations/nextjs/
├── app/
│   ├── _components/
│   │   └── post-list.tsx      # Post list with pagination
│   └── blog/
│       └── [id]/[slug]/
│           └── page.tsx       # Post detail page
├── lib/
│   ├── api-client.ts          # API client setup
│   ├── providers.tsx          # React Query provider
│   └── queries/
│       └── posts/
│           └── index.ts       # Post queries using @qbjs/client
└── package.json
```

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Set up environment variables:

```bash
cp .env.example .env
```

3. Run the development server:

```bash
pnpm dev
```

4. Open [http://localhost:3001](http://localhost:3001) in your browser.

## Key Files

### `lib/queries/posts/index.ts`

Demonstrates:
- Query key factory using `createQueryKey`
- Fluent QueryBuilder API usage
- Filter helpers (`f.eq`, `f.and`, `f.or`)
- Pagination helpers (`nextPage`, `prevPage`)
- Search query building

### `app/_components/post-list.tsx`

Demonstrates:
- Building queries with `query()` fluent API
- URL-based pagination with `nextPage`/`prevPage`
- Filtered queries with `f` helpers

## Learn More

- [@qbjs/client Documentation](https://qbjs.asof.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Query Documentation](https://tanstack.com/query)
