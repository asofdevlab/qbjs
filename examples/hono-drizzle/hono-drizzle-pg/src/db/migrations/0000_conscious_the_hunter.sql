CREATE TABLE "post" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"thumbnail_url" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "post_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "post_published_idx" ON "post" USING btree ("published");