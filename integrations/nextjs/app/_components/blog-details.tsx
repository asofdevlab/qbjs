"use client"

import { useQuery } from "@tanstack/react-query"
import { useGetDetailsPost } from "@/lib/queries/posts"

export default function BlogDetails({ id, slug }: { id: string; slug: string }) {
	const { data } = useQuery(useGetDetailsPost(id, slug))
	return (
		<div className="flex flex-col space-y-2">
			<h1 className="text-3xl font-semibold">{data?.title}</h1>
			<p>{data?.content}</p>
		</div>
	)
}
