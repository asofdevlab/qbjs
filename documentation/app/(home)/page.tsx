import { Code, Database, GitBranch, Layers, Shield, Zap } from "lucide-react"
import Link from "next/link"

const features = [
	{
		icon: Layers,
		title: "Parser → AST → Compiler",
		description:
			"Clean architecture with a well-defined Abstract Syntax Tree for maximum flexibility and extensibility.",
	},
	{
		icon: Shield,
		title: "Security-First",
		description: "Built-in security configuration for field allowlisting, operator restrictions, and query limits.",
	},
	{
		icon: Zap,
		title: "Type-Safe",
		description: "Full TypeScript support with comprehensive type definitions for a great developer experience.",
	},
	{
		icon: Database,
		title: "Multi-Database",
		description: "Works with PostgreSQL, MySQL, and SQLite through Drizzle ORM compilers.",
	},
	{
		icon: Code,
		title: "Framework Integration",
		description: "First-class support for Hono with middleware included. Easy to integrate with any framework.",
	},
	{
		icon: GitBranch,
		title: "Flexible Filtering",
		description: "Support for comparison, string, and logical operators with nested filter expressions.",
	},
]

const technologies = [
	{ name: "Drizzle ORM", href: "https://orm.drizzle.team" },
	{ name: "Hono", href: "https://hono.dev" },
	{ name: "PostgreSQL", href: "https://www.postgresql.org" },
	{ name: "MySQL", href: "https://www.mysql.com" },
	{ name: "SQLite", href: "https://www.sqlite.org" },
	{ name: "TypeScript", href: "https://www.typescriptlang.org" },
]

const codeExample = `import { createQueryBuilder, createDrizzlePgCompiler } from "@qbjs/core";
import { users } from "./db/schema";

const queryBuilder = createQueryBuilder({
  config: {
    allowedFields: ["id", "name", "email", "status"],
    maxLimit: 100,
  },
  compiler: createDrizzlePgCompiler(),
});

// GET /users?filter[status][eq]=active&sort=-createdAt&limit=10
app.get("/users", async (c) => {
  const result = queryBuilder.executeFromUrl(c.req.url, users);
  
  if (result.errors.length > 0) {
    return c.json({ errors: result.errors }, 400);
  }

  const data = await db.query.users.findMany(result.query);
  return c.json(data);
});`

export default function HomePage() {
	return (
		<div className="flex flex-col">
			{/* Hero Section */}
			<section className="flex flex-col items-center justify-center text-center px-4 py-20 md:py-32">
				<h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Query String Query Builder</h1>
				<p className="text-lg md:text-xl text-fd-muted-foreground max-w-2xl mb-8">
					An ORM-agnostic query builder for building type-safe queries from API request query strings. Transform{" "}
					<code className="bg-fd-muted px-1.5 py-0.5 rounded text-sm">?filter[status][eq]=active</code> into database
					queries.
				</p>
				<div className="flex flex-col sm:flex-row gap-4">
					<Link
						href="/docs"
						className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-fd-primary text-fd-primary-foreground font-medium hover:bg-fd-primary/90 transition-colors"
					>
						Get Started
					</Link>
					<Link
						href="https://github.com/asofdevlab/qbjs"
						className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-fd-border font-medium hover:bg-fd-muted transition-colors"
					>
						View on GitHub
					</Link>
				</div>
			</section>

			{/* Features Section */}
			<section className="px-4 py-16 md:py-24 bg-fd-muted/30">
				<div className="max-w-6xl mx-auto">
					<h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Why qbjs?</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{features.map((feature) => (
							<div key={feature.title} className="p-6 rounded-lg border border-fd-border bg-fd-card">
								<feature.icon className="w-10 h-10 mb-4 text-fd-primary" />
								<h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
								<p className="text-fd-muted-foreground text-sm">{feature.description}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Code Example Section */}
			<section className="px-4 py-16 md:py-24">
				<div className="max-w-4xl mx-auto">
					<h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Simple & Powerful</h2>
					<p className="text-fd-muted-foreground text-center mb-8 max-w-2xl mx-auto">
						Build secure, type-safe API endpoints with just a few lines of code. qbjs handles parsing, validation, and
						compilation automatically.
					</p>
					<div className="rounded-lg border border-fd-border overflow-hidden">
						<div className="bg-fd-muted px-4 py-2 border-b border-fd-border">
							<span className="text-sm text-fd-muted-foreground">Example: Hono + Drizzle</span>
						</div>
						<pre className="p-4 overflow-x-auto text-sm bg-fd-card">
							<code>{codeExample}</code>
						</pre>
					</div>
				</div>
			</section>

			{/* Supported Technologies Section */}
			<section className="px-4 py-16 md:py-24 bg-fd-muted/30">
				<div className="max-w-4xl mx-auto text-center">
					<h2 className="text-2xl md:text-3xl font-bold mb-4">Works With Your Stack</h2>
					<p className="text-fd-muted-foreground mb-8">qbjs integrates seamlessly with popular tools and databases.</p>
					<div className="flex flex-wrap justify-center gap-4">
						{technologies.map((tech) => (
							<a
								key={tech.name}
								href={tech.href}
								target="_blank"
								rel="noopener noreferrer"
								className="px-4 py-2 rounded-full border border-fd-border bg-fd-card hover:bg-fd-muted transition-colors text-sm font-medium"
							>
								{tech.name}
							</a>
						))}
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="px-4 py-16 md:py-24">
				<div className="max-w-2xl mx-auto text-center">
					<h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Get Started?</h2>
					<p className="text-fd-muted-foreground mb-8">
						Install qbjs and build your first type-safe API endpoint in minutes.
					</p>
					<div className="bg-fd-muted rounded-lg p-4 mb-6">
						<code className="text-sm">pnpm add @qbjs/core</code>
					</div>
					<Link
						href="/docs/getting-started/installation"
						className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-fd-primary text-fd-primary-foreground font-medium hover:bg-fd-primary/90 transition-colors"
					>
						Read the Documentation
					</Link>
				</div>
			</section>
		</div>
	)
}
