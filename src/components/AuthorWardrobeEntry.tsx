import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

const AUTHOR_UID = import.meta.env.VITE_AUTHOR_UID;

/** Keep the author's public wardrobe discoverable after a visitor signs in. */
export function AuthorWardrobeEntry({ label = '查看作者衣柜', className = '' }: { label?: string; className?: string }) {
  if (!AUTHOR_UID) return null;

  return (
    <Link
      to="/author"
      className={`header-action-button author-wardrobe-entry ${className}`}
    >
      <span className="author-wardrobe-entry__label-full">{label}</span>
      <span className="author-wardrobe-entry__label-short">作者衣柜</span>
      <ArrowRight className="w-3 h-3" />
    </Link>
  );
}
