import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

const AUTHOR_UID = import.meta.env.VITE_AUTHOR_UID;

/** Keep the author's public wardrobe discoverable after a visitor signs in. */
export function AuthorWardrobeEntry() {
  if (!AUTHOR_UID) return null;

  return (
    <div className="mb-6 sm:mb-10 border border-dashed border-graphite/30 bg-tag/60 px-4 sm:px-5 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/50 mb-1">
          Victor's Wardrobe
        </p>
        <p className="font-story text-[15px] font-semibold text-ink">
          先看看作者的衣柜和搭配
        </p>
      </div>
      <Link
        to="/author"
        className="shrink-0 inline-flex items-center justify-center gap-2 min-h-11 px-5 bg-stamp text-white font-tag text-[11px] uppercase tracking-wider font-bold hover:bg-stamp/90 transition-colors shadow-sm"
      >
        查看作者衣柜
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
