import { defineI18nUI } from "fumadocs-ui/i18n"
import { RootProvider } from "fumadocs-ui/provider/next"
import type { Metadata } from "next"
import { Geist } from "next/font/google"
import { i18n } from "@/lib/i18n"

import "./global.css"

const geist = Geist({
	subsets: ["latin"],
})

const { provider } = defineI18nUI(i18n, {
	translations: {
		en: {
			displayName: "English",
			search: "Search...",
		},
		id: {
			displayName: "Indonesia",
			search: "Pencarian...",
		},
	},
})

export const metadata: Metadata = {
	alternates: {
		types: {
			"application/rss+xml": [
				{
					title: "Qbjs Blog",
					url: "https://qbjs.vercel.app/blog",
				},
			],
		},
	},
}

export default async function Layout({
	params,
	children,
}: { params: Promise<{ lang: string }>; children: React.ReactNode } & LayoutProps<"/[lang]">) {
	const lang = (await params).lang
	return (
		<html lang={lang} className={geist.className} suppressHydrationWarning>
			<body className="flex flex-col min-h-screen">
				<RootProvider i18n={provider(lang)}>{children}</RootProvider>
			</body>
		</html>
	)
}
