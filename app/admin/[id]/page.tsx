import { notFound } from "next/navigation";
import Link from "next/link";
import { getArticleById } from "@/lib/articles";
import { getScheduledPostsForArticle } from "@/lib/scheduledPosts";
import EditorForm from "@/components/EditorForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminArticlePage({ params }: PageProps) {
  const { id } = await params;
  let article;

  try {
    article = await getArticleById(id);
  } catch (error) {
    console.error("Failed to load article:", error);
    return <p className="pt-alert-error">This article is temporarily unavailable.</p>;
  }

  if (!article) notFound();

  let scheduled: Awaited<ReturnType<typeof getScheduledPostsForArticle>> = [];
  try {
    scheduled = await getScheduledPostsForArticle(id);
  } catch (error) {
    console.error("Failed to load scheduled posts:", error);
  }

  return (
    <div>
      <Link
        href="/admin"
        className="mb-6 inline-block text-sm text-ink-soft hover:text-ink hover:underline"
      >
        ← Back to dashboard
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-ink">Review draft</h1>
      <EditorForm article={article} initialScheduled={scheduled} />
    </div>
  );
}
