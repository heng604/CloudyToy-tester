import ContentPage from "@/components/ContentPage";
import type { PageSlug } from "@shared/pages";
export default function ContentRoute({ slug, title }: { slug: PageSlug; title: string }) { return <ContentPage slug={slug} title={title} />; }
