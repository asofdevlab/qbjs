import { z } from "@hono/zod-openapi"

const IdSlugParamsSchema = z.object({
	id: z.cuid2().openapi({
		param: {
			name: "id",
			in: "path",
			required: true,
		},
		required: ["id"],
		example: "stxhzfp8lruxfxxetmtzff7f",
	}),
	slug: z
		.string()
		.min(1)
		.max(255)
		.openapi({
			param: {
				name: "slug",
				in: "path",
				required: true,
			},
			required: ["slug"],
			example: "my-blog-post-title",
		}),
})

export default IdSlugParamsSchema
