"use client"

import { f, nextPage, prevPage, query } from "@qbjs/client"
import { useQuery } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { useGetAllPost } from "@/lib/queries/posts"

export function PostLists() {
	const router = useRouter()
	const searchParams = useSearchParams()

	// Get page from URL or default to 1
	const currentPage = Number(searchParams.get("page")) || 1
	const limit = 2

	// Build query params using the fluent QueryBuilder API
	const queryParams = useMemo(
		() =>
			query()
				.paginate(currentPage, limit)
				.sortDesc("createdAt")
				.fields("id", "title", "content", "slug", "createdAt")
				.toParams(),
		[currentPage],
	)

	const { data: posts, isLoading, error } = useQuery(useGetAllPost(queryParams))

	// Pagination handlers using @qbjs/client helpers
	const goToNextPage = useCallback(() => {
		const next = nextPage(currentPage)
		router.push(`?page=${next}`)
	}, [currentPage, router])

	const goToPrevPage = useCallback(() => {
		const prev = prevPage(currentPage)
		router.push(`?page=${prev}`)
	}, [currentPage, router])

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center min-h-svh">
				<p>Loading...</p>
			</div>
		)
	}

	if (error) {
		return <div className="text-center py-8 text-red-500">Error: {error.message}</div>
	}

	if (!posts || !Array.isArray(posts) || posts.length === 0) {
		return <div className="text-center py-8 text-gray-500">No posts yet.</div>
	}

	return (
		<div className="space-y-4">
			<article className="space-y-2">
				{posts.map((post) => (
					<div
						key={post.id}
						className="space-y-2 bg-background border border-gray-200 px-4 py-2 rounded-md shadow-xl cursor-pointer hover:border-gray-400 transition-colors"
						onClick={() => router.push(`/blog/${post.id}/${post.slug}`)}
					>
						<div>
							<h1 className="text-2xl font-semibold">{post.title}</h1>
						</div>
						<div>
							{post.content && <p className="mt-2 text-gray-600 line-clamp-2">{post.content}</p>}
							{post.createdAt && (
								<time className="text-sm text-gray-400">{new Date(post.createdAt).toLocaleDateString()}</time>
							)}
						</div>
					</div>
				))}
			</article>

			{/* Pagination Controls */}
			<div className="flex justify-between items-center pt-4">
				<button
					onClick={goToPrevPage}
					disabled={currentPage === 1}
					className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition-colors"
				>
					Previous
				</button>
				<span className="text-gray-600">Page {currentPage}</span>
				<button
					onClick={goToNextPage}
					disabled={posts.length < limit}
					className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition-colors"
				>
					Next
				</button>
			</div>
		</div>
	)
}

/**
 * Example: Filtered Post List using filter helpers
 * Demonstrates the `f` filter helper for building type-safe filters
 */
export function PublishedPostList() {
	const router = useRouter()

	// Build query with filter using the fluent API and filter helpers
	const queryParams = useMemo(
		() =>
			query()
				.paginate(1, 10)
				.sortDesc("createdAt")
				.fields("id", "title", "slug", "createdAt")
				.filter({ published: f.eq(true) })
				.toParams(),
		[],
	)

	const { data: posts, isLoading, error } = useQuery(useGetAllPost(queryParams))

	if (isLoading) return <p>Loading published posts...</p>
	if (error) return <p className="text-red-500">Error: {error.message}</p>
	if (!posts?.length) return <p className="text-gray-500">No published posts.</p>

	return (
		<div className="space-y-2">
			<h2 className="text-xl font-semibold">Published Posts</h2>
			{posts.map((post) => (
				<div
					key={post.id}
					className="p-3 border rounded cursor-pointer hover:bg-gray-50"
					onClick={() => router.push(`/blog/${post.id}/${post.slug}`)}
				>
					<h3 className="font-medium">{post.title}</h3>
					{post.createdAt && (
						<time className="text-sm text-gray-400">{new Date(post.createdAt).toLocaleDateString()}</time>
					)}
				</div>
			))}
		</div>
	)
}

/**
 * Example: Search Posts Component
 * Demonstrates search functionality with @qbjs/client
 */
export function SearchPosts() {
	const [searchTerm, setSearchTerm] = useState("")

	return (
		<div className="space-y-4">
			<input
				type="text"
				placeholder="Search posts..."
				value={searchTerm}
				onChange={(e) => setSearchTerm(e.target.value)}
				className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
			{searchTerm && <p className="text-sm text-gray-500">Searching for: {searchTerm}</p>}
		</div>
	)
}
