import BlogDetails from "@/app/_components/blog-details"

type Params = {
	id: string
	slug: string
}

type PageProps = {
	params: Promise<Params>
}

export default async function DetailsBlog({ params }: PageProps) {
	const { id, slug } = await params

	return <BlogDetails id={id} slug={slug} />
}
