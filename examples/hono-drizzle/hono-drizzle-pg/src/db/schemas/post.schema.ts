import { boolean, index, pgTable, text } from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import { z } from "zod"
import { createCuid2, createdAt, deletedAt, slug, updatedAt } from "./helpers"

// Post Table
export const post = pgTable(
	"post",
	{
		id: createCuid2,
		slug,
		thumbnailUrl: text("thumbnail_url"),
		title: text("title").notNull(),
		content: text("content").notNull(),
		published: boolean("published").default(false).notNull(),
		createdAt,
		updatedAt,
		deletedAt,
	},
	(table) => [index("post_published_idx").on(table.published)],
)

// Select Schema (READ)
export const selectPostSchema = createSelectSchema(post).partial().omit({ deletedAt: true })
export type selectPostSchema = z.infer<typeof selectPostSchema>

// Insert Schema (CREATE)
export const insertPostSchema = createInsertSchema(post, {
	title: (schema) => schema.min(3, "Title at least 3 Characters").max(255, "Title cannot more than 255 Characters"),
	content: (schema) => schema.min(1, "Content is mandatory"),
	thumbnailUrl: () =>
		z
			.url({ message: "URL thumbnail is not valid" })
			.refine((url) => /^https?:\/\//.test(url), {
				message: "URL thumbnail must be using HTTP/HTTPS",
			})
			.optional()
			.nullable(),
}).omit({
	id: true,
	slug: true,
	createdAt: true,
	updatedAt: true,
	deletedAt: true,
})
export type insertPostSchema = z.infer<typeof insertPostSchema>

// Patch Schema (UPDATE)
export const patchPostSchema = insertPostSchema.partial()
export type patchPostSchema = z.infer<typeof patchPostSchema>
