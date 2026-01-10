/**
 * Security Configuration Types for @qbjs/core
 *
 * This module defines the security configuration types and defaults
 * for protecting APIs from malicious queries.
 *
 * @module security/types
 */

import type { FilterOperator } from "../ast/types";
import { FILTER_OPERATORS } from "../ast/types";

/**
 * Security configuration for query validation.
 *
 * This configuration allows restricting which fields, relations, and operators
 * can be used in queries, as well as setting limits on pagination.
 */
export interface SecurityConfig {
	/** Fields that are allowed to be queried. Empty array means all fields allowed. */
	allowedFields?: string[];
	/** Relations that are allowed to be joined. Empty array means all relations allowed. */
	allowedRelations?: string[];
	/** Maximum limit for pagination. Queries exceeding this will be capped. max. limit is 100 */
	maxLimit?: number;
	/** Filter operators that are allowed. If not specified, defaults are used. */
	operators?: FilterOperator[];
	/** Default limit when not specified in query */
	defaultLimit?: number;
	/** Default page when not specified in query */
	defaultPage?: number;
}

/**
 * Fully resolved security configuration with all required fields.
 */
export interface ResolvedSecurityConfig {
	/** Fields that are allowed to be queried. Empty array means all fields allowed. */
	allowedFields: string[];
	/** Relations that are allowed to be joined. Empty array means all relations allowed. */
	allowedRelations: string[];
	/** Maximum limit for pagination. Queries exceeding this will be capped. */
	maxLimit: number;
	/** Filter operators that are allowed. */
	operators: FilterOperator[];
	/** Default limit when not specified in query */
	defaultLimit: number;
	/** Default page when not specified in query */
	defaultPage: number;
}

/**
 * Default security configuration.
 *
 * Provides sensible defaults:
 * - All fields allowed (empty array)
 * - All relations allowed (empty array)
 * - Max limit of 100 items per page
 * - Common safe operators enabled
 * - Default limit of 10 items
 * - Default page of 1
 */
export const DEFAULT_SECURITY_CONFIG: ResolvedSecurityConfig = {
	allowedFields: [], // Empty means all fields allowed
	allowedRelations: [], // Empty means all relations allowed
	maxLimit: 100,
	operators: [...FILTER_OPERATORS], // All operators allowed by default
	defaultLimit: 10,
	defaultPage: 1,
};

/**
 * Merge user-provided security config with defaults.
 *
 * @param config - User-provided partial security config
 * @returns Fully resolved security config with defaults applied
 */
export function resolveSecurityConfig(config?: SecurityConfig): ResolvedSecurityConfig {
	if (!config) {
		return { ...DEFAULT_SECURITY_CONFIG };
	}

	return {
		allowedFields: config.allowedFields ?? DEFAULT_SECURITY_CONFIG.allowedFields,
		allowedRelations: config.allowedRelations ?? DEFAULT_SECURITY_CONFIG.allowedRelations,
		maxLimit: config.maxLimit ?? DEFAULT_SECURITY_CONFIG.maxLimit,
		operators: config.operators ?? DEFAULT_SECURITY_CONFIG.operators,
		defaultLimit: config.defaultLimit ?? DEFAULT_SECURITY_CONFIG.defaultLimit,
		defaultPage: config.defaultPage ?? DEFAULT_SECURITY_CONFIG.defaultPage,
	};
}
