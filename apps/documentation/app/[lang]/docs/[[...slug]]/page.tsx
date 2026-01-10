import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page"
import { createRelativeLink } from "fumadocs-ui/mdx"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPageImage, source } from "@/lib/source"
import { getMDXComponents } from "@/mdx-components"

export default async function Page({
	params,
}: {
	params: Promise<{ lang: string; slug?: string[] }>
} & PageProps<"/[lang]/docs/[[...slug]]">) {
	const { slug, lang } = await params

	const page = source.getPage(slug, lang)
	if (!page) notFound()

	const MDX = page.data.body

	return (
		<DocsPage toc={page.data.toc} full={page.data.full}>
			<DocsTitle>{page.data.title}</DocsTitle>
			<DocsDescription>{page.data.description}</DocsDescription>
			<DocsBody>
				<MDX
					components={getMDXComponents({
						// this allows you to link to other pages with relative file paths
						a: createRelativeLink(source, page),
					})}
				/>
			</DocsBody>
		</DocsPage>
	)
}

export async function generateStaticParams() {
	return source.generateParams("slug", "lang")
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ lang: string; slug?: string[] }>
} & PageProps<"/[lang]/docs/[[...slug]]">): Promise<Metadata> {
	const { slug, lang } = await params

	const page = source.getPage(slug, lang)
	if (!page) notFound()

	return {
		title: page.data.title,
		description: page.data.description,
		openGraph: {
			images: getPageImage(page).url,
		},
	}
}
