import Link from "next/link"

export default function HomePage() {
	return (
		<main className="container mx-auto flex flex-col space-y-4 items-center justify-center min-h-svh">
			<h1 className="text-2xl font-semibold">Welcome to qbjs integration example with nextjs & tanstack query</h1>
			<Link className="border px-4 py-2 rounded-md border-gray-300 shadow-md" href="/blog">
				Go To Blog Post
			</Link>
		</main>
	)
}
