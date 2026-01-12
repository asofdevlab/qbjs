/** biome-ignore-all lint/style/noProcessEnv: <> */
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	transpilePackages: ["@repo/api-client"],

	async rewrites() {
		return [
			{
				source: "/api/:path*",
				destination: `${process.env.SERVER_URL}/api/:path*`,
			},
		]
	},
}

export default nextConfig
