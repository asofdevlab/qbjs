/**
 * Security Module for @qbjs/core
 *
 * This module provides security configuration and validation for query parsing.
 *
 * @module security
 */

// Types
export type { ResolvedSecurityConfig, SecurityConfig } from "./types";
export { DEFAULT_SECURITY_CONFIG, resolveSecurityConfig } from "./types";
// Validator
export type { SecurityError, SecurityValidationResult, SecurityWarning } from "./validator";
export {
	extractFilterFields,
	validateFields,
	validateFilterFields,
	validateLimit,
	validateOperators,
	validateSecurity,
	validateSortFields,
} from "./validator";
