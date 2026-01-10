import { eq } from "drizzle-orm"
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core"

export function slugify(str: string) {
	return str
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, "")
		.replace(/[\s_-]+/g, "-")
		.replace(/^-+|-+$/g, "")
}

/**
 * Generates a unique slug for any table by checking for duplicates.
 * It appends a number if a slug already exists (e.g., 'my-slug-1').
 * @param name The string to slugify.
 * @param db The Drizzle database instance.
 * @param table The Drizzle table schema object (e.g., `tasks`).
 * @param slugColumn The specific column in the table to check for uniqueness (e.g., `tasks.slug`).
 * @returns A promise that resolves to a unique slug string.
 */
export async function generateUniqueSlug(
	name: string,
	db: any, // You can use a more specific Drizzle type here if you have one defined
	table: PgTable,
	slugColumn: AnyPgColumn,
): Promise<string> {
	const baseSlug = slugify(name)
	let uniqueSlug = baseSlug
	let counter = 1

	// Loop until we find a slug that doesn't exist in the database
	while (true) {
		// This generic select statement can query any table
		const [existing] = await db
			.select({ [slugColumn.name]: slugColumn }) // Select the column itself to check for existence
			.from(table)
			.where(eq(slugColumn, uniqueSlug))
			.limit(1)

		if (!existing) {
			// If no record with this slug exists, we've found our unique slug.
			break
		}

		// If a record with this slug exists, append the counter and try again.
		uniqueSlug = `${baseSlug}-${counter}`
		counter++
	}

	return uniqueSlug
}
