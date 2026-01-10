import { Feed } from "feed"
import { source } from "@/lib/source"

const baseUrl = "https://qbjs.vercel.app"

export function getRSS() {
	const feed = new Feed({
		title: "qbjs blog",
		id: `${baseUrl}/blog`,
		link: `${baseUrl}/blog`,
		language: "en",

		image: `${baseUrl}/banner.png`,
		favicon: `${baseUrl}/icon.png`,
		copyright: "All rights reserved 2025, Fuma Nama",
	})

	for (const page of source.getPages()) {
		feed.addItem({
			id: page.url,
			title: page.data.title,
			description: page.data.description,
			link: `${baseUrl}${page.url}`,
			date: new Date(),

			author: [
				{
					name: "Fuma",
				},
			],
		})
	}

	return feed.rss2()
}
