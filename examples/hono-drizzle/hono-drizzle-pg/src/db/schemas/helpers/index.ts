import { createId } from "@paralleldrive/cuid2"
import { text, timestamp, uuid } from "drizzle-orm/pg-core"

export const createdAt = timestamp("created_at").defaultNow().notNull()
export const deletedAt = timestamp("deleted_at")
export const updatedAt = timestamp("updated_at")
	.defaultNow()
	.$onUpdate(() => new Date())
	.notNull()

export const id = text("id").primaryKey()
export const createUuid = uuid("id").defaultRandom().primaryKey()
export const createCuid2 = text("id")
	.$defaultFn(() => createId())
	.primaryKey()
export const slug = text("slug").notNull().unique()
