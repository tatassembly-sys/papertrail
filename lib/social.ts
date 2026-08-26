import type { ArticleRow } from "@/lib/prompts";
import { postToFacebook } from "@/lib/facebook";
import { postToInstagram } from "@/lib/instagram";
import { postToReddit } from "@/lib/reddit";
import { postToX } from "@/lib/x";
import type { SocialPostResult } from "@/types/types";

export const POSTERS: Record<string, (article: ArticleRow) => Promise<SocialPostResult>> = {
  facebook: postToFacebook,
  instagram: postToInstagram,
  reddit: postToReddit,
  x: postToX,
};

export const VALID_PLATFORMS = Object.keys(POSTERS);
