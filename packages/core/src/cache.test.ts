import { afterEach, describe, expect, it } from "vitest"
import {
	createLRUCache,
	createQueryCache,
	DEFAULT_CACHE_CONFIG,
	getGlobalQueryCache,
	QueryCache,
	resetGlobalQueryCache,
} from "./cache"

describe("LRU Cache", () => {
	describe("Property 16: Caching Consistency", () => {
		/**
		 * **Feature: query-parameter-enhancement, Property 16: Caching Consistency**
		 * **Validates: Requirements 5.4**
		 *
		 * For any identical query string parsed multiple times with caching enabled,
		 * subsequent parses should return the same cached result
		 */
		it("should return same cached result for identical keys", () => {
			const cache = createLRUCache<string>({ maxSize: 100, ttl: 60000, autoCleanup: false })

			// Test with various key-value pairs
			const testCases = [
				{ key: "query1", value: "result1" },
				{ key: "filter[name][eq]=john", value: '{"name":{"eq":"john"}}' },
				{ key: "page=1&limit=10", value: '{"page":1,"limit":10}' },
				{ key: "sort=-createdAt&fields=id,name", value: '{"sort":"-createdAt"}' },
				{ key: "complex[nested][deep]=value", value: '{"complex":{"nested":{"deep":"value"}}}' },
			]

			for (const testCase of testCases) {
				// Set the value
				cache.set(testCase.key, testCase.value)

				// Get the value multiple times
				const result1 = cache.get(testCase.key)
				const result2 = cache.get(testCase.key)
				const result3 = cache.get(testCase.key)

				// All results should be identical
				expect(result1).toBe(testCase.value)
				expect(result2).toBe(testCase.value)
				expect(result3).toBe(testCase.value)
				expect(result1).toBe(result2)
				expect(result2).toBe(result3)
			}

			cache.destroy()
		})

		it("should maintain cache consistency across many operations", () => {
			const cache = createLRUCache<object>({ maxSize: 50, ttl: 60000, autoCleanup: false })

			// Generate test data
			const entries: Array<{ key: string; value: object }> = []
			for (let i = 0; i < 100; i++) {
				entries.push({
					key: `query_${i}_filter[id][eq]=${i}`,
					value: { id: i, data: `result_${i}`, nested: { level: i % 5 } },
				})
			}

			// Set all entries (some will be evicted due to maxSize)
			for (const entry of entries) {
				cache.set(entry.key, entry.value)
			}

			// Verify consistency: for any key that exists, value should match
			for (const entry of entries) {
				const result = cache.get(entry.key)
				if (result !== undefined) {
					// If cached, should be exactly the same object
					expect(result).toEqual(entry.value)
				}
			}

			// Verify cache size doesn't exceed maxSize
			expect(cache.size).toBeLessThanOrEqual(50)

			cache.destroy()
		})

		it("should return undefined for non-existent keys consistently", () => {
			const cache = createLRUCache<string>({ maxSize: 10, ttl: 60000, autoCleanup: false })

			// Set some values
			cache.set("existing", "value")

			// Non-existent keys should always return undefined
			const nonExistentKeys = ["nonexistent", "filter[missing]=true", "page=999", "", "special!@#$%"]

			for (const key of nonExistentKeys) {
				expect(cache.get(key)).toBeUndefined()
				expect(cache.get(key)).toBeUndefined()
				expect(cache.has(key)).toBe(false)
			}

			cache.destroy()
		})

		it("should maintain consistency after updates", () => {
			const cache = createLRUCache<string>({ maxSize: 10, ttl: 60000, autoCleanup: false })

			const key = "filter[status][eq]=active"

			// Set initial value
			cache.set(key, "initial_result")
			expect(cache.get(key)).toBe("initial_result")

			// Update value
			cache.set(key, "updated_result")

			// All subsequent gets should return updated value
			expect(cache.get(key)).toBe("updated_result")
			expect(cache.get(key)).toBe("updated_result")
			expect(cache.get(key)).toBe("updated_result")

			cache.destroy()
		})
	})

	describe("Basic Operations", () => {
		it("should set and get values correctly", () => {
			const cache = createLRUCache<string>({ autoCleanup: false })

			cache.set("key1", "value1")
			cache.set("key2", "value2")

			expect(cache.get("key1")).toBe("value1")
			expect(cache.get("key2")).toBe("value2")
			expect(cache.get("nonexistent")).toBeUndefined()

			cache.destroy()
		})

		it("should check existence with has()", () => {
			const cache = createLRUCache<string>({ autoCleanup: false })

			cache.set("exists", "value")

			expect(cache.has("exists")).toBe(true)
			expect(cache.has("missing")).toBe(false)

			cache.destroy()
		})

		it("should delete entries correctly", () => {
			const cache = createLRUCache<string>({ autoCleanup: false })

			cache.set("key", "value")
			expect(cache.has("key")).toBe(true)

			const deleted = cache.delete("key")
			expect(deleted).toBe(true)
			expect(cache.has("key")).toBe(false)

			const deletedAgain = cache.delete("key")
			expect(deletedAgain).toBe(false)

			cache.destroy()
		})

		it("should clear all entries", () => {
			const cache = createLRUCache<string>({ autoCleanup: false })

			cache.set("key1", "value1")
			cache.set("key2", "value2")
			cache.set("key3", "value3")

			expect(cache.size).toBe(3)

			cache.clear()

			expect(cache.size).toBe(0)
			expect(cache.has("key1")).toBe(false)
			expect(cache.has("key2")).toBe(false)
			expect(cache.has("key3")).toBe(false)

			cache.destroy()
		})
	})

	describe("LRU Eviction", () => {
		it("should evict least recently used entries when at capacity", () => {
			const cache = createLRUCache<string>({ maxSize: 3, autoCleanup: false })

			cache.set("key1", "value1")
			cache.set("key2", "value2")
			cache.set("key3", "value3")

			expect(cache.size).toBe(3)

			// Adding a 4th entry should evict the LRU (key1)
			cache.set("key4", "value4")

			expect(cache.size).toBe(3)
			expect(cache.has("key1")).toBe(false) // Evicted
			expect(cache.has("key2")).toBe(true)
			expect(cache.has("key3")).toBe(true)
			expect(cache.has("key4")).toBe(true)

			cache.destroy()
		})

		it("should update LRU order on access", () => {
			const cache = createLRUCache<string>({ maxSize: 3, autoCleanup: false })

			cache.set("key1", "value1")
			cache.set("key2", "value2")
			cache.set("key3", "value3")

			// Access key1 to make it most recently used
			cache.get("key1")

			// Adding key4 should now evict key2 (the new LRU)
			cache.set("key4", "value4")

			expect(cache.has("key1")).toBe(true) // Was accessed, not evicted
			expect(cache.has("key2")).toBe(false) // Evicted
			expect(cache.has("key3")).toBe(true)
			expect(cache.has("key4")).toBe(true)

			cache.destroy()
		})
	})

	describe("TTL Expiration", () => {
		it("should expire entries after TTL", async () => {
			const cache = createLRUCache<string>({ ttl: 50, autoCleanup: false })

			cache.set("key", "value")
			expect(cache.get("key")).toBe("value")

			// Wait for TTL to expire
			await new Promise((resolve) => setTimeout(resolve, 60))

			expect(cache.get("key")).toBeUndefined()

			cache.destroy()
		})

		it("should not return expired entries with has()", async () => {
			const cache = createLRUCache<string>({ ttl: 50, autoCleanup: false })

			cache.set("key", "value")
			expect(cache.has("key")).toBe(true)

			await new Promise((resolve) => setTimeout(resolve, 60))

			expect(cache.has("key")).toBe(false)

			cache.destroy()
		})
	})

	describe("Statistics", () => {
		it("should track hits and misses", () => {
			const cache = createLRUCache<string>({ autoCleanup: false })

			cache.set("key", "value")

			// Hits
			cache.get("key")
			cache.get("key")

			// Misses
			cache.get("missing1")
			cache.get("missing2")
			cache.get("missing3")

			const stats = cache.getStats()
			expect(stats.hits).toBe(2)
			expect(stats.misses).toBe(3)
			expect(stats.hitRatio).toBeCloseTo(0.4, 2)

			cache.destroy()
		})

		it("should track evictions by reason", () => {
			const cache = createLRUCache<string>({ maxSize: 2, autoCleanup: false })

			cache.set("key1", "value1")
			cache.set("key2", "value2")
			cache.set("key3", "value3") // Evicts key1 (capacity)

			cache.delete("key2") // Manual eviction

			const stats = cache.getStats()
			expect(stats.evictions).toBe(2)
			expect(stats.evictionsByReason.capacity).toBe(1)
			expect(stats.evictionsByReason.manual).toBe(1)

			cache.destroy()
		})

		it("should reset statistics", () => {
			const cache = createLRUCache<string>({ autoCleanup: false })

			cache.set("key", "value")
			cache.get("key")
			cache.get("missing")

			cache.resetStats()

			const stats = cache.getStats()
			expect(stats.hits).toBe(0)
			expect(stats.misses).toBe(0)
			expect(stats.evictions).toBe(0)

			cache.destroy()
		})
	})

	describe("Pattern Invalidation", () => {
		it("should invalidate entries matching string prefix", () => {
			const cache = createLRUCache<string>({ autoCleanup: false })

			cache.set("user:1", "data1")
			cache.set("user:2", "data2")
			cache.set("post:1", "post1")
			cache.set("post:2", "post2")

			const invalidated = cache.invalidatePattern("user:")

			expect(invalidated).toBe(2)
			expect(cache.has("user:1")).toBe(false)
			expect(cache.has("user:2")).toBe(false)
			expect(cache.has("post:1")).toBe(true)
			expect(cache.has("post:2")).toBe(true)

			cache.destroy()
		})

		it("should invalidate entries matching regex pattern", () => {
			const cache = createLRUCache<string>({ autoCleanup: false })

			cache.set("filter[name][eq]=john", "result1")
			cache.set("filter[age][gt]=18", "result2")
			cache.set("sort=-createdAt", "result3")

			const invalidated = cache.invalidatePattern(/^filter\[/)

			expect(invalidated).toBe(2)
			expect(cache.has("filter[name][eq]=john")).toBe(false)
			expect(cache.has("filter[age][gt]=18")).toBe(false)
			expect(cache.has("sort=-createdAt")).toBe(true)

			cache.destroy()
		})
	})
})

describe("QueryCache", () => {
	describe("Query-specific operations", () => {
		it("should generate consistent cache keys", () => {
			const key1 = QueryCache.generateKey("page=1&limit=10", "posts")
			const key2 = QueryCache.generateKey("page=1&limit=10", "posts")
			const key3 = QueryCache.generateKey("page=1&limit=10", "users")
			const key4 = QueryCache.generateKey("page=1&limit=10")

			expect(key1).toBe(key2)
			expect(key1).not.toBe(key3)
			expect(key1).not.toBe(key4)
			expect(key1).toBe("page=1&limit=10:posts")
			expect(key4).toBe("page=1&limit=10")
		})

		it("should set and get query results", () => {
			const cache = createQueryCache({ autoCleanup: false })

			const queryResult = { data: [{ id: 1 }, { id: 2 }], total: 2 }
			cache.setQuery("page=1&limit=10", queryResult, "posts")

			const result = cache.getQuery("page=1&limit=10", "posts")
			expect(result).toEqual(queryResult)

			cache.destroy()
		})

		it("should check query existence", () => {
			const cache = createQueryCache({ autoCleanup: false })

			cache.setQuery("page=1", { data: [] }, "posts")

			expect(cache.hasQuery("page=1", "posts")).toBe(true)
			expect(cache.hasQuery("page=2", "posts")).toBe(false)
			expect(cache.hasQuery("page=1", "users")).toBe(false)

			cache.destroy()
		})

		it("should invalidate schema-specific entries", () => {
			const cache = createQueryCache({ autoCleanup: false })

			cache.setQuery("page=1", { data: [] }, "posts")
			cache.setQuery("page=2", { data: [] }, "posts")
			cache.setQuery("page=1", { data: [] }, "users")

			const invalidated = cache.invalidateSchema("posts")

			expect(invalidated).toBe(2)
			expect(cache.hasQuery("page=1", "posts")).toBe(false)
			expect(cache.hasQuery("page=2", "posts")).toBe(false)
			expect(cache.hasQuery("page=1", "users")).toBe(true)

			cache.destroy()
		})
	})
})

describe("Global Query Cache", () => {
	afterEach(() => {
		resetGlobalQueryCache()
	})

	it("should return singleton instance", () => {
		const cache1 = getGlobalQueryCache()
		const cache2 = getGlobalQueryCache()

		expect(cache1).toBe(cache2)
	})

	it("should reset global cache", () => {
		const cache1 = getGlobalQueryCache()
		cache1.set("key", "value")

		resetGlobalQueryCache()

		const cache2 = getGlobalQueryCache()
		expect(cache2).not.toBe(cache1)
		expect(cache2.has("key")).toBe(false)
	})
})

describe("Default Configuration", () => {
	it("should have sensible defaults", () => {
		expect(DEFAULT_CACHE_CONFIG.maxSize).toBe(1000)
		expect(DEFAULT_CACHE_CONFIG.ttl).toBe(300000) // 5 minutes
		expect(DEFAULT_CACHE_CONFIG.autoCleanup).toBe(true)
		expect(DEFAULT_CACHE_CONFIG.cleanupInterval).toBe(60000) // 1 minute
	})
})
