import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { LogoImage } from "@/components/logo";

export function baseOptions(): BaseLayoutProps {
	return {
		nav: {
			title: <LogoImage />,
		},
		githubUrl: "https://github.com/asofdevlab/qbjs",
	};
}
