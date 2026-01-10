import { z } from "@hono/zod-openapi"

const IdCUID2ParamsSchema = z.object({
	id: z.cuid2().openapi({
		param: {
			name: "id",
			in: "path",
			required: true,
		},
		required: ["id"],
		example: "stxhzfp8lruxfxxetmtzff7f",
	}),
})

export default IdCUID2ParamsSchema
