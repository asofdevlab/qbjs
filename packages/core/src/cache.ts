/**
 * LRU Cache Implementation for Query Result Caching
 *
 * Provides a configurable Least Recently Used (LRU) cache with:
 * - Configurable maximum size
 * - Time-to-live (TTL) support for cache entries
 * - Cache invalidation strategies
 * - Performance monitoring and statistics
 *
 * **Validates: Requirements 5.4**
 */

/**
 * Configuration options for the LRU cache
 */
export interface LRUCacheConfig {
	/** Maximum number of entries in the cache (default: 1000) */
	maxSize?: number
	/** Time-to-live for cache entries in milliseconds (default: 300000 = 5 minutes) */
	ttl?: number
	/** Enable automatic cleanup of expired entries (default: true) */
	autoCleanup?: boolean
	/** Interval for automatic cleanup in milliseconds (default: 60000 = 1 minute) */
	cleanupInterval?: number
	/** Callback when an entry is evicted */
	onEvict?: (key: string, value: any, reason: EvictionReason) => void
}

/**
 * Reasons for cache entry eviction
 */
export type EvictionReason = "expired" | "capacity" | "manual" | "clear"

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
	value: T
	createdAt: number
	lastAccessedAt: number
	accessCount: number
	size: number
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
	/** Current number of entries in the cache */
	size: number
	/** Maximum cache size */
	maxSize: number
	/** Total number of cache hits */
	hits: number
	/** Total number of cache misses */
	misses: number
	/** Cache hit ratio (hits / (hits + misses)) */
	hitRatio: number
	/** Total number of evictions */
	evictions: number
	/** Evictions by reason */
	evictionsByReason: Record<EvictionReason, number>
	/** Estimated memory usage in bytes */
	estimatedMemoryUsage: number
	/** Average entry age in milliseconds */
	averageEntryAge: number
	/** Average access count per entry */
	averageAccessCount: number
}

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: Required<LRUCacheConfig> = {
	maxSize: 1000,
	ttl: 300000, // 5 minutes
	autoCleanup: true,
	cleanupInterval: 60000, // 1 minute
	onEvict: () => {},
}

/**
 * LRU Cache implementation with TTL support
 *
 * Uses a Map for O(1) access and maintains LRU order by
 * re-inserting entries on access (Map maintains insertion order).
 */
export class LRUCache<T = any> {
	private cache: Map<string, CacheEntry<T>>
	private config: Required<LRUCacheConfig>
	private cleanupTimer: ReturnType<typeof setInterval> | null = null

	// Statistics
	private hits = 0
	private misses = 0
	private evictions = 0
	private evictionsByReason: Record<EvictionReason, number> = {
		expired: 0,
		capacity: 0,
		manual: 0,
		clear: 0,
	}

	constructor(config: LRUCacheConfig = {}) {
		this.config = { ...DEFAULT_CACHE_CONFIG, ...config }
		this.cache = new Map()

		// Start automatic cleanup if enabled
		if (this.config.autoCleanup) {
			this.startAutoCleanup()
		}
	}

	/**
	 * Get a value from the cache
	 * Updates access time and moves entry to end (most recently used)
	 */
	get(key: string): T | undefined {
		const entry = this.cache.get(key)

		if (!entry) {
			this.misses++
			return undefined
		}

		// Check if entry has expired
		if (this.isExpired(entry)) {
			this.evict(key, "expired")
			this.misses++
			return undefined
		}

		// Update access metadata and move to end (most recently used)
		entry.lastAccessedAt = Date.now()
		entry.accessCount++

		// Re-insert to move to end of Map (maintains LRU order)
		this.cache.delete(key)
		this.cache.set(key, entry)

		this.hits++
		return entry.value
	}

	/**
	 * Set a value in the cache
	 * Evicts least recently used entries if capacity is exceeded
	 */
	set(key: string, value: T): void {
		const now = Date.now()
		const size = this.estimateSize(value)

		// If key already exists, update it
		if (this.cache.has(key)) {
			this.cache.delete(key)
		}

		// Evict entries if at capacity
		while (this.cache.size >= this.config.maxSize) {
			this.evictLRU()
		}

		const entry: CacheEntry<T> = {
			value,
			createdAt: now,
			lastAccessedAt: now,
			accessCount: 1,
			size,
		}

		this.cache.set(key, entry)
	}

	/**
	 * Check if a key exists in the cache (without updating access time)
	 */
	has(key: string): boolean {
		const entry = this.cache.get(key)
		if (!entry) return false
		if (this.isExpired(entry)) {
			this.evict(key, "expired")
			return false
		}
		return true
	}

	/**
	 * Delete a specific entry from the cache
	 */
	delete(key: string): boolean {
		if (this.cache.has(key)) {
			this.evict(key, "manual")
			return true
		}
		return false
	}

	/**
	 * Clear all entries from the cache
	 */
	clear(): void {
		const size = this.cache.size
		for (const key of this.cache.keys()) {
			this.config.onEvict(key, this.cache.get(key)?.value, "clear")
		}
		this.cache.clear()
		this.evictions += size
		this.evictionsByReason.clear += size
	}

	/**
	 * Get the current size of the cache
	 */
	get size(): number {
		return this.cache.size
	}

	/**
	 * Get all keys in the cache
	 */
	keys(): IterableIterator<string> {
		return this.cache.keys()
	}

	/**
	 * Get comprehensive cache statistics
	 */
	getStats(): CacheStats {
		const now = Date.now()
		let totalAge = 0
		let totalAccessCount = 0
		let totalMemory = 0

		for (const entry of this.cache.values()) {
			totalAge += now - entry.createdAt
			totalAccessCount += entry.accessCount
			totalMemory += entry.size
		}

		const size = this.cache.size
		const totalRequests = this.hits + this.misses

		return {
			size,
			maxSize: this.config.maxSize,
			hits: this.hits,
			misses: this.misses,
			hitRatio: totalRequests > 0 ? this.hits / totalRequests : 0,
			evictions: this.evictions,
			evictionsByReason: { ...this.evictionsByReason },
			estimatedMemoryUsage: totalMemory,
			averageEntryAge: size > 0 ? totalAge / size : 0,
			averageAccessCount: size > 0 ? totalAccessCount / size : 0,
		}
	}

	/**
	 * Reset cache statistics
	 */
	resetStats(): void {
		this.hits = 0
		this.misses = 0
		this.evictions = 0
		this.evictionsByReason = {
			expired: 0,
			capacity: 0,
			manual: 0,
			clear: 0,
		}
	}

	/**
	 * Manually trigger cleanup of expired entries
	 */
	cleanup(): number {
		let cleaned = 0
		const now = Date.now()

		for (const [key, entry] of this.cache.entries()) {
			if (now - entry.createdAt > this.config.ttl) {
				this.evict(key, "expired")
				cleaned++
			}
		}

		return cleaned
	}

	/**
	 * Invalidate entries matching a pattern
	 * @param pattern - String prefix or RegExp to match keys
	 */
	invalidatePattern(pattern: string | RegExp): number {
		let invalidated = 0

		for (const key of this.cache.keys()) {
			const matches = typeof pattern === "string" ? key.startsWith(pattern) : pattern.test(key)

			if (matches) {
				this.evict(key, "manual")
				invalidated++
			}
		}

		return invalidated
	}

	/**
	 * Invalidate entries older than a specified age
	 * @param maxAge - Maximum age in milliseconds
	 */
	invalidateOlderThan(maxAge: number): number {
		let invalidated = 0
		const cutoff = Date.now() - maxAge

		for (const [key, entry] of this.cache.entries()) {
			if (entry.createdAt < cutoff) {
				this.evict(key, "expired")
				invalidated++
			}
		}

		return invalidated
	}

	/**
	 * Update the TTL for the cache
	 */
	setTTL(ttl: number): void {
		this.config.ttl = ttl
	}

	/**
	 * Update the maximum cache size
	 * Will evict entries if new size is smaller than current size
	 */
	setMaxSize(maxSize: number): void {
		this.config.maxSize = maxSize

		// Evict entries if over new capacity
		while (this.cache.size > maxSize) {
			this.evictLRU()
		}
	}

	/**
	 * Stop automatic cleanup
	 */
	stopAutoCleanup(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer)
			this.cleanupTimer = null
		}
	}

	/**
	 * Start automatic cleanup
	 */
	startAutoCleanup(): void {
		this.stopAutoCleanup()
		this.cleanupTimer = setInterval(() => {
			this.cleanup()
		}, this.config.cleanupInterval)
	}

	/**
	 * Destroy the cache and clean up resources
	 */
	destroy(): void {
		this.stopAutoCleanup()
		this.clear()
	}

	/**
	 * Check if an entry has expired
	 */
	private isExpired(entry: CacheEntry<T>): boolean {
		return Date.now() - entry.createdAt > this.config.ttl
	}

	/**
	 * Evict a specific entry
	 */
	private evict(key: string, reason: EvictionReason): void {
		const entry = this.cache.get(key)
		if (entry) {
			this.config.onEvict(key, entry.value, reason)
			this.cache.delete(key)
			this.evictions++
			this.evictionsByReason[reason]++
		}
	}

	/**
	 * Evict the least recently used entry
	 */
	private evictLRU(): void {
		// Map maintains insertion order, so first key is LRU
		const firstKey = this.cache.keys().next().value
		if (firstKey !== undefined) {
			this.evict(firstKey, "capacity")
		}
	}

	/**
	 * Estimate the memory size of a value in bytes
	 */
	private estimateSize(value: any): number {
		if (value === null || value === undefined) return 0
		if (typeof value === "boolean") return 4
		if (typeof value === "number") return 8
		if (typeof value === "string") return value.length * 2 // UTF-16
		if (Array.isArray(value)) {
			return value.reduce((sum, item) => sum + this.estimateSize(item), 0) + 8 * value.length
		}
		if (typeof value === "object") {
			return Object.entries(value).reduce((sum, [key, val]) => sum + key.length * 2 + this.estimateSize(val), 0)
		}
		return 0
	}
}

/**
 * Create a new LRU cache instance
 */
export function createLRUCache<T = any>(config?: LRUCacheConfig): LRUCache<T> {
	return new LRUCache<T>(config)
}

/**
 * Query-specific cache with schema-aware key generation
 */
export class QueryCache extends LRUCache<any> {
	/**
	 * Generate a cache key from query string and schema name
	 */
	static generateKey(queryString: string, schemaName?: string): string {
		const normalizedQuery = queryString.trim()
		return schemaName ? `${normalizedQuery}:${schemaName}` : normalizedQuery
	}

	/**
	 * Get a cached query result
	 */
	getQuery<T>(queryString: string, schemaName?: string): T | undefined {
		const key = QueryCache.generateKey(queryString, schemaName)
		return this.get(key) as T | undefined
	}

	/**
	 * Set a cached query result
	 */
	setQuery<T>(queryString: string, value: T, schemaName?: string): void {
		const key = QueryCache.generateKey(queryString, schemaName)
		this.set(key, value)
	}

	/**
	 * Check if a query result is cached
	 */
	hasQuery(queryString: string, schemaName?: string): boolean {
		const key = QueryCache.generateKey(queryString, schemaName)
		return this.has(key)
	}

	/**
	 * Invalidate all cached results for a specific schema
	 */
	invalidateSchema(schemaName: string): number {
		return this.invalidatePattern(new RegExp(`:${schemaName}$`))
	}
}

/**
 * Create a new query cache instance
 */
export function createQueryCache(config?: LRUCacheConfig): QueryCache {
	return new QueryCache(config)
}

/**
 * Global query cache instance (singleton)
 */
let globalQueryCache: QueryCache | null = null

/**
 * Get or create the global query cache
 */
export function getGlobalQueryCache(config?: LRUCacheConfig): QueryCache {
	if (!globalQueryCache) {
		globalQueryCache = createQueryCache(config)
	}
	return globalQueryCache
}

/**
 * Reset the global query cache
 */
export function resetGlobalQueryCache(): void {
	if (globalQueryCache) {
		globalQueryCache.destroy()
		globalQueryCache = null
	}
}
