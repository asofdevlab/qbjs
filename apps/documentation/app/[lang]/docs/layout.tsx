import { DocsLayout } from "fumadocs-ui/layouts/docs"
import { baseOptions } from "@/lib/layout.shared"
import { source } from "@/lib/source"

export default async function Layout({
	params,
	children,
}: {
	params: Promise<{ lang: string }>
	children: React.ReactNode
} & LayoutProps<"/[lang]">) {
	const { lang } = await params

	return (
		<DocsLayout tree={source.getPageTree()} {...baseOptions(lang)}>
			{children}
		</DocsLayout>
	)
}
