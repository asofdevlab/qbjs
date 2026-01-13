import { buildQuery, buildSearchQuery, type QueryParams, type SearchQueryParams } from "@qbjs/client"
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import apiClient from "@/lib/api-client"

// Query key factory for cache management
export const postKeys = {
	all: ["posts"],
	lists: () => [...postKeys.all, "list"],
	list: (params?: QueryParams) => [...postKeys.lists(), params],
	details: () => [...postKeys.all, "detail"],
	detail: (id: string) => [...postKeys.details(), id],
}

export const useGetAllPost = (params?: QueryParams) =>
	queryOptions({
		queryKey: postKeys.list(params),
		queryFn: async () => {
			const res = await apiClient.posts.$get({ query: buildQuery(params) })
			if (!res.ok) throw new Error("Gagal mengambil data blog post")
			return res.json()
		},
	})

export const useSearchPost = (params: SearchQueryParams) =>
	queryOptions({
		queryKey: postKeys.list(params),
		queryFn: async () => {
			const res = await apiClient.posts.search.$get({ query: buildSearchQuery(params) })
			if (!res.ok) throw new Error("Gagal mengambil data blog post")
			return res.json()
		},
	})

export const useGetDetailsPost = (id: string, slug: string) =>
	queryOptions({
		queryKey: postKeys.detail(id),
		queryFn: async () => {
			const res = await apiClient.posts[":id"][":slug"].$get({
				param: {
					id,
					slug,
				},
				query: {
					fields: "title,content",
				},
			})
			if (!res.ok) {
				throw new Error("Gagal mengambil data blog post")
			}
			return res.json()
		},
	})

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
				throw new Error("error" in error ? String(error.error) : "Gagal mengambil data blog post")
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
