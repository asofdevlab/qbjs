"use client"

import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useGetAllPost } from "@/lib/queries/posts"

export function PostLists() {
	const router = useRouter()

	const {
		data: posts,
		isLoading,
		error,
	} = useQuery(
		useGetAllPost({
			fields: "id,title,content,slug,content,createdAt",
			limit: 10,
			page: 1,
			sort: "title:asc",
		}),
	)

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center min-h-svh">
				<p>loading...</p>
			</div>
		)
	}

	if (error) {
		return <div className="text-center py-8 text-red-500">Error: {error.message}</div>
	}

	if (!posts || !Array.isArray(posts) || posts.length === 0) {
		return <div className="text-center py-8 text-gray-500">Belum ada postingan.</div>
	}

	return (
		<article className="space-y-2">
			{posts.map((post) => {
				return (
					<div
						key={post.id}
						className="space-y-2 bg-background border border-gray-200 px-4 py-2 rounded-md shadow-xl cursor-pointer"
						onClick={() => router.push(`/blog/${post.id}/${post.slug}`)}
					>
						<div>
							<h1 className="text-2xl font-semibold">{post.title}</h1>
						</div>
						<div>
							{post.content && <p className="mt-2 text-gray-600">{post.content}</p>}
							{post.createdAt && (
								<time className="text-sm text-gray-400">{new Date(post.createdAt).toLocaleDateString()}</time>
							)}
						</div>
					</div>
				)
			})}
		</article>
	)
}
