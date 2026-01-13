import {
	buildSearchQuery,
	calculateOffset,
	createQueryKey,
	type Filter,
	f,
	nextPage,
	prevPage,
	type QueryParams,
	query,
	type SearchQueryParams,
} from "@qbjs/client"
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import apiClient from "@/lib/api-client"

// ============================================================================
// Query Key Factory using @qbjs/client's createQueryKey
// ============================================================================

export const postKeys = {
	all: ["posts"] as const,
	lists: () => [...postKeys.all, "list"] as const,
	list: (params?: QueryParams) => createQueryKey([...postKeys.lists()], params),
	search: (params: SearchQueryParams) => createQueryKey([...postKeys.all, "search"], params),
	details: () => [...postKeys.all, "detail"] as const,
	detail: (id: string) => [...postKeys.details(), id] as const,
}

// ============================================================================
// Post List Query - Using Fluent QueryBuilder API
// ============================================================================

/**
 * Get all posts with optional filtering, sorting, and pagination.
 * Uses the new fluent QueryBuilder API from @qbjs/client.
 *
 * @example
 * // Simple usage with defaults
 * useQuery(useGetAllPost())
 *
 * @example
 * // With custom params using QueryBuilder
 * const params = query()
 *   .page(1)
 *   .limit(10)
 *   .sortDesc('createdAt')
 *   .fields('id', 'title', 'slug', 'createdAt')
 *   .filter({ published: f.eq(true) })
 *   .toParams()
 * useQuery(useGetAllPost(params))
 */
export const useGetAllPost = (params?: QueryParams) =>
	queryOptions({
		queryKey: postKeys.list(params),
		queryFn: async () => {
			// Use QueryBuilder to build the query
			const builder = query()
			if (params?.page) builder.page(params.page)
			if (params?.limit) builder.limit(params.limit)
			if (params?.sort) {
				for (const s of params.sort) {
					builder.sort(s.field, s.direction)
				}
			}
			if (params?.fields) builder.fields(...params.fields)
			if (params?.filter) builder.filter(params.filter)

			const res = await apiClient.posts.$get({ query: builder.build() })
			if (!res.ok) throw new Error("Failed to fetch blog posts")
			return res.json()
		},
	})

// ============================================================================
// Filtered Posts Query - Demonstrating Filter Helpers
// ============================================================================

/**
 * Get published posts only using filter helpers.
 * Demonstrates the `f` filter helper object.
 *
 * @example
 * useQuery(useGetPublishedPosts({ page: 1, limit: 10 }))
 */
export const useGetPublishedPosts = (pagination?: { page?: number; limit?: number }) =>
	queryOptions({
		queryKey: postKeys.list({
			...pagination,
			filter: { published: f.eq(true) },
		}),
		queryFn: async () => {
			const builder = query()
				.paginate(pagination?.page ?? 1, pagination?.limit ?? 10)
				.sortDesc("createdAt")
				.fields("id", "title", "slug", "content", "createdAt")
				.filter({ published: f.eq(true) })

			const res = await apiClient.posts.$get({ query: builder.build() })
			if (!res.ok) throw new Error("Failed to fetch published posts")
			return res.json()
		},
	})

// ============================================================================
// Search Posts Query - Using buildSearchQuery
// ============================================================================

/**
 * Search posts with a query string.
 * Uses buildSearchQuery for search functionality.
 *
 * @example
 * useQuery(useSearchPost({ q: 'typescript', page: 1, limit: 10 }))
 */
export const useSearchPost = (params: SearchQueryParams) =>
	queryOptions({
		queryKey: postKeys.search(params),
		queryFn: async () => {
			const res = await apiClient.posts.search.$get({ query: buildSearchQuery(params) })
			if (!res.ok) throw new Error("Failed to search blog posts")
			return res.json()
		},
	})

// ============================================================================
// Advanced Filtering - Demonstrating Logical Operators
// ============================================================================

/**
 * Get posts with complex filtering using logical operators.
 * Demonstrates AND, OR, NOT filter combinations.
 *
 * @example
 * // Get published posts that are either featured OR have many views
 * const filter = f.and(
 *   { published: f.eq(true) },
 *   f.or(
 *     { featured: f.eq(true) },
 *     { views: f.gte(1000) }
 *   )
 * )
 * useQuery(useGetFilteredPosts(filter))
 */
export const useGetFilteredPosts = (filter: Filter, pagination?: { page?: number; limit?: number }) =>
	queryOptions({
		queryKey: postKeys.list({ ...pagination, filter }),
		queryFn: async () => {
			const builder = query()
				.paginate(pagination?.page ?? 1, pagination?.limit ?? 10)
				.sortDesc("createdAt")
				.filter(filter)

			const res = await apiClient.posts.$get({ query: builder.build() })
			if (!res.ok) throw new Error("Failed to fetch filtered posts")
			return res.json()
		},
	})

// ============================================================================
// Post Details Query
// ============================================================================

export const useGetDetailsPost = (id: string, slug: string) =>
	queryOptions({
		queryKey: postKeys.detail(id),
		queryFn: async () => {
			const res = await apiClient.posts[":id"][":slug"].$get({
				param: { id, slug },
				query: { fields: "title,content" },
			})
			if (!res.ok) throw new Error("Failed to fetch blog post details")
			return res.json()
		},
	})

// ============================================================================
// Mutations
// ============================================================================

export function useCreatePost() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (data: {
			title: string
			content: string
			slug: string
			published?: boolean
			authorId: string
		}) => {
			const res = await apiClient.posts.$post({ json: data })
			if (!res.ok) {
				const error = await res.json()
				throw new Error("error" in error ? String(error.error) : "Failed to create post")
			}
			return res.json()
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: postKeys.lists() })
		},
	})
}

export function useUpdatePost() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			id,
			data,
		}: {
			id: string
			data: {
				title?: string
				content?: string
				slug?: string
				published?: boolean
			}
		}) => {
			const postClient = apiClient.posts
			const idRoute = postClient[":id"] as {
				$patch: (args: {
					param: { id: string }
					json: { title?: string; content?: string; slug?: string; published?: boolean }
				}) => Promise<Response>
			}
			const res = await idRoute.$patch({
				param: { id },
				json: data,
			})
			if (!res.ok) {
				const error = await res.json()
				throw new Error("error" in error ? String(error.error) : "Failed to update post")
			}
			return res.json()
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: postKeys.detail(variables.id) })
			queryClient.invalidateQueries({ queryKey: postKeys.lists() })
		},
	})
}

// ============================================================================
// Pagination Helpers - Re-exported for convenience
// ============================================================================

export { calculateOffset, nextPage, prevPage }
