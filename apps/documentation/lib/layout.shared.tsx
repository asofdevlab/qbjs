import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"
import { i18n } from "@/lib/i18n"

export function baseOptions(locale: string): BaseLayoutProps {
	function docText() {
		switch (locale) {
			case "en":
				return "Documentation"

			case "id":
				return "Dokumentasi"

			default:
				return "Documentation"
		}
	}

	return {
		i18n,
		nav: {
			title: (
				<h1 className="px-4 py-1 rounded-md text-xl bg-linear-to-r from-pink-400 via-pink-200 to-pink-100 dark:text-black">
					qbjs
				</h1>
			),
			url: `/${locale}`,
		},
		githubUrl: "https://github.com/asofdevlab/qbjs",
		themeSwitch: {
			mode: "light-dark",
		},
		links: [
			{
				text: docText(),
				url: `${locale}/docs`,
				active: "url",
			},
		],
	}
}
