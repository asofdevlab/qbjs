import apiClient from "@repo/api-client";

// Use relative URL since Next.js rewrites /api/* to SERVER_URL/api/*
// This works for both server and client components
export default apiClient("").api;
