import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

const AUTHOR_UID = import.meta.env.VITE_AUTHOR_UID;

/** Keep the author's public wardrobe discoverable after a visitor signs in. */
export function AuthorWardrobeEntry() {
  if (!AUTHOR_UID) return null;

  return (
    <Link
      to="/author"
      className="shrink-0 inline-flex items-center justify-center gap-1.5 min-h-10 px-3 border border-stamp/45 text-stamp font-tag text-[10px] uppercase tracking-wider font-bold hover:bg-stamp/8 transition-colors whitespace-nowrap"
    >
      查看作者衣柜
      <ArrowRight className="w-3 h-3" />
    </Link>
  );
}
