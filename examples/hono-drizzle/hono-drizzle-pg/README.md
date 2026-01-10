# Hono + Drizzle + PostgreSQL Example

A complete example demonstrating how to use `@qbjs/core` with [Hono](https://hono.dev/), [Drizzle ORM](https://orm.drizzle.team/), and PostgreSQL to build a type-safe REST API with powerful query capabilities.

## Features

- **Full CRUD API** for blog posts with OpenAPI documentation
- **Query String Parsing** with filtering, sorting, pagination, and field selection
- **Security Configuration** with field allowlisting and query limits
- **Type-Safe Queries** using Drizzle ORM with PostgreSQL
- **OpenAPI/Swagger** documentation via `@hono/zod-openapi`
- **Structured Error Responses** with detailed validation feedback
- **Performance Monitoring** with query timing metrics

## Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 18+
- PostgreSQL database
- pnpm (for monorepo workspace)

## Getting Started

### 1. Install Dependencies

From the repository root:

```bash
pnpm install
```

Or from this directory:

```bash
bun install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Update `.env` with your PostgreSQL connection string:

```env
NODE_ENV=development
SERVER_URL=http://localhost:8787
SERVER_PORT=8787
DATABASE_URL=postgresql://user:password@localhost:5432/qbjs_example
LOG_LEVEL=debug
```

### 3. Set Up Database

Run database migrations:

```bash
bun run db:push
```

Or generate and run migrations:

```bash
bun run db:generate
bun run db:migrate
```

### 4. Start the Server

```bash
bun run dev
```

The API will be available at http://localhost:8787

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posts` | List posts with filtering, sorting, pagination |
| POST | `/api/posts` | Create a new post |
| GET | `/api/posts/{id}/{slug}` | Get a single post by ID and slug |
| GET | `/api/posts/search?q=term` | Search posts by title and content |
| PATCH | `/api/posts/{id}` | Update a post |
| DELETE | `/api/posts/{id}` | Delete a post |

### OpenAPI Documentation

Visit http://localhost:8787/reference for interactive API documentation powered by Scalar.

## Query Examples

### Filtering

Filter posts using the `filter` query parameter with bracket notation:

```bash
# Filter by exact match
GET /api/posts?filter[published][eq]=true

# Filter with case-insensitive contains
GET /api/posts?filter[title][containsi]=hono

# Multiple filters (AND)
GET /api/posts?filter[published][eq]=true&filter[title][containsi]=tutorial
```

**Supported Filter Operators:**

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equal | `filter[published][eq]=true` |
| `ne` | Not equal | `filter[published][ne]=false` |
| `gt` | Greater than | `filter[createdAt][gt]=2024-01-01` |
| `gte` | Greater than or equal | `filter[id][gte]=10` |
| `lt` | Less than | `filter[createdAt][lt]=2024-12-31` |
| `lte` | Less than or equal | `filter[id][lte]=100` |
| `contains` | Contains (case-sensitive) | `filter[title][contains]=Hono` |
| `containsi` | Contains (case-insensitive) | `filter[title][containsi]=hono` |
| `startsWith` | Starts with | `filter[title][startsWith]=Getting` |
| `endsWith` | Ends with | `filter[slug][endsWith]=-guide` |
| `null` | Is null | `filter[thumbnailUrl][null]=true` |
| `notNull` | Is not null | `filter[thumbnailUrl][notNull]=true` |

### Sorting

Sort results using the `sort` parameter:

```bash
# Sort by single field (ascending)
GET /api/posts?sort=createdAt

# Sort descending (prefix with -)
GET /api/posts?sort=-createdAt

# Multiple sort fields
GET /api/posts?sort=-published,createdAt
```

### Pagination

Control result pagination with `page` and `limit`:

```bash
# Get first 10 posts
GET /api/posts?limit=10

# Get second page (posts 11-20)
GET /api/posts?page=2&limit=10

# Combine with sorting
GET /api/posts?sort=-createdAt&page=1&limit=5
```

### Field Selection

Select specific fields to return:

```bash
# Return only id, title, and slug
GET /api/posts?fields=id,title,slug

# Combine with filtering and sorting
GET /api/posts?fields=id,title,createdAt&filter[published][eq]=true&sort=-createdAt
```

### Combined Example

```bash
# Get published posts containing "tutorial", sorted by date, page 1 with 5 items
GET /api/posts?filter[published][eq]=true&filter[title][containsi]=tutorial&sort=-createdAt&page=1&limit=5&fields=id,title,slug,createdAt
```

## Security Configuration

This example demonstrates security best practices using `@qbjs/core`'s security configuration:

```typescript
// src/routes/post/post.handlers.ts

const queryBuilder = createQueryBuilder({
  config: {
    // Only allow these fields to be queried/returned
    allowedFields: [
      "id",
      "title", 
      "slug",
      "content",
      "thumbnailUrl",
      "published",
      "createdAt",
      "updatedAt",
    ],
    // Maximum items per request (prevents resource exhaustion)
    maxLimit: 100,
    // Default items when limit not specified
    defaultLimit: 10,
  },
  compiler: createDrizzlePgCompiler(),
});
```

### Security Features Demonstrated

1. **Field Allowlisting**: Only explicitly allowed fields can be queried or returned
2. **Query Limits**: `maxLimit` prevents clients from requesting too many records
3. **Default Limits**: Sensible defaults when clients don't specify pagination
4. **Input Validation**: All query parameters are validated before execution
5. **Structured Errors**: Invalid queries return detailed error responses

### Error Response Example

When a query validation fails, the API returns a structured error:

```json
{
  "message": "Query parameter validation failed",
  "code": "QUERY_VALIDATION_ERROR",
  "errors": [
    {
      "field": "filter.invalidField",
      "code": "INVALID_VALUE",
      "message": "Field 'invalidField' is not allowed",
      "path": ["filter", "invalidField"]
    }
  ],
  "warnings": [],
  "suggestions": [],
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": 1234567890
}
```

## Project Structure

```
src/
├── app.ts                 # Application setup
├── index.ts               # Server entry point
├── db/
│   ├── index.ts           # Database connection
│   ├── schemas/           # Drizzle table schemas
│   └── migrations/        # Database migrations
├── lib/
│   ├── create-app.ts      # Hono app factory
│   ├── create-router.ts   # Router factory
│   ├── env.ts             # Environment validation
│   └── types.ts           # TypeScript types
├── middlewares/
│   ├── cors-middleware.ts # CORS configuration
│   └── pino-logger.ts     # Request logging
└── routes/
    └── post/
        ├── post.handlers.ts  # Route handlers with qbjs
        ├── post.routes.ts    # OpenAPI route definitions
        └── post.index.ts     # Route registration
```

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development server with hot reload |
| `bun run build` | Build for production |
| `bun run start` | Start production server |
| `bun run test` | Run tests |
| `bun run db:generate` | Generate database migrations |
| `bun run db:migrate` | Run database migrations |
| `bun run db:push` | Push schema changes directly |
| `bun run db:studio` | Open Drizzle Studio |

## Learn More

- [qbjs Documentation](https://qbjs.vercel.app)
- [Hono Documentation](https://hono.dev/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [OpenAPI with Hono](https://hono.dev/examples/zod-openapi)
