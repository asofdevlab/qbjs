# Contributing to qbjs

Thank you for your interest in contributing to qbjs! This guide will help you get started with development and understand our contribution process.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Running Tests](#running-tests)
- [Pull Request Process](#pull-request-process)
- [Commit Message Convention](#commit-message-convention)
- [Reporting Issues](#reporting-issues)

## Development Setup

### Prerequisites

- Node.js >= 20
- pnpm >= 9.0.0

### Installation

1. Fork and clone the repository:

```bash
git clone https://github.com/asofdevlab/qbjs.git
cd qbjs
```

2. Install dependencies:

```bash
pnpm install
```

3. Build the packages:

```bash
pnpm build
```

4. Run tests to verify setup:

```bash
pnpm test
```

## Project Structure

This is a pnpm monorepo managed with Turborepo. Here's the structure:

```
qbjs/
├── packages/
│   └── core/                 # @qbjs/core - Main library
│       ├── src/
│       │   ├── ast/          # AST types, parser, and printer
│       │   ├── builder/      # Query builder factory
│       │   ├── compiler/     # Database compilers (Drizzle PG, MySQL, SQLite)
│       │   ├── middleware/   # Hono middleware
│       │   └── security/     # Security validation
│       └── package.json
├── documentation/            # Fumadocs documentation site
│   ├── content/docs/         # MDX documentation files
│   └── app/                  # Next.js app
├── examples/
│   └── hono-drizzle/         # Example projects
│       └── hono-drizzle-pg/  # Hono + Drizzle + PostgreSQL example
├── package.json              # Root package.json
├── pnpm-workspace.yaml       # pnpm workspace configuration
└── turbo.json                # Turborepo configuration
```

### Key Directories

- **packages/core/src/ast/**: The Abstract Syntax Tree implementation including parser and printer
- **packages/core/src/compiler/**: Database-specific compilers that transform AST to ORM queries
- **packages/core/src/security/**: Security validation and configuration
- **packages/core/src/builder/**: The main `createQueryBuilder` factory

## Coding Standards

We use [Biome](https://biomejs.dev/) for linting and formatting.

### Formatting

```bash
# Format all files
pnpm format

# Check formatting without making changes
pnpm format --check
```

### Linting

Biome handles both linting and formatting. The configuration is in `biome.json` at the root and package levels.

Key rules:
- Use tabs for indentation
- Use double quotes for strings
- No semicolons (configured in Biome)
- Prefer `const` over `let` when possible
- Use TypeScript strict mode

### Type Checking

```bash
pnpm check-types
```

## Running Tests

We use [Vitest](https://vitest.dev/) for testing.

```bash
# Run all tests
pnpm test

# Run tests in watch mode (for development)
pnpm --filter @qbjs/core test -- --watch

# Run tests for a specific file
pnpm --filter @qbjs/core test -- src/ast/parser.test.ts
```

### Writing Tests

- Place test files next to the source files with `.test.ts` suffix
- Use descriptive test names that explain the expected behavior
- Include both unit tests and property-based tests where appropriate
- We use [fast-check](https://github.com/dubzzz/fast-check) for property-based testing

## Pull Request Process

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the coding standards

3. **Write or update tests** for your changes

4. **Run the full test suite**:
   ```bash
   pnpm test
   pnpm check-types
   pnpm format --check
   ```

5. **Commit your changes** using conventional commits (see below)

6. **Push your branch** and create a Pull Request

7. **Fill out the PR template** with:
   - Description of changes
   - Related issues
   - Testing performed
   - Checklist items

### Review Process

- All PRs require at least one approval before merging
- CI must pass (tests, type checking, linting)
- Keep PRs focused and reasonably sized
- Respond to review feedback promptly

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code changes that neither fix bugs nor add features
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
feat(parser): add support for nested filters
fix(compiler): handle null values in PostgreSQL compiler
docs: update README with new API examples
test(security): add property tests for field validation
```

## Reporting Issues

### Bug Reports

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml) and include:

- Environment details (OS, Node version, package version)
- Steps to reproduce
- Expected behavior
- Actual behavior
- Code sample if applicable

### Feature Requests

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml) and include:

- Use case description
- Proposed solution
- Alternatives considered

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Questions?

If you have questions, feel free to:

- Open a [discussion](https://github.com/asofdevlab/qbjs/discussions)
- Check existing [issues](https://github.com/asofdevlab/qbjs/issues)

Thank you for contributing! 🎉
