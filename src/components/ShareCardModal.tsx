import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import { X, Download, Share2, Loader2, Check, Copy, Globe, EyeOff } from 'lucide-react';
import { BestMatch, WardrobeItem } from '../types';
import type { BundleEntry } from './TagBundle';
import { TagBundle } from './TagBundle';
import { SharedItemCard } from './SharedItemCard';
import {
  setItemShared,
  setMatchShared,
  isWardrobePublic,
  setWardrobePublic,
  isItemReferencedByOtherSharedMatches,
} from '../lib/sharing';
import { resolveMediaUrl } from '../lib/media';

export type ShareTarget =
  | { kind: 'item'; item: WardrobeItem }
  | { kind: 'bestMatch'; match: BestMatch; entries: BundleEntry[] };

interface Props {
  target: ShareTarget;
  shareUrl: string;
  onClose: () => void;
  /** 当前用户全部搭配 —— 取消分享某套搭配时，用于跳过仍被其它已分享搭配引用的单品 */
  allMatches?: BestMatch[];
}

const CAPTURE_WIDTH = 480;

export function ShareCardModal({ target, shareUrl, onClose, allMatches }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  // 这一条是否已可公开访问（打开分享卡即自动置 true）
  const [thisShared, setThisShared] = useState<boolean | null>(null); // null = 处理中
  const [togglingThis, setTogglingThis] = useState(false);
  // 整柜公开开关
  const [wardrobePublic, setWardrobePublicState] = useState<boolean | null>(null);
  const [togglingWardrobe, setTogglingWardrobe] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const shortUrl = shareUrl.replace(/^https?:\/\//, '');

  useEffect(() => {
    QRCode.toDataURL(shareUrl, { margin: 1, width: 240, color: { dark: '#1C1C1A', light: '#FDFCF5' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [shareUrl]);

  // 打开分享卡即自动让这一条可公开访问（链接默认就能打开）
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (target.kind === 'item') await setItemShared(target.item.id, true);
        else await setMatchShared(target.match, true, allMatches);
        if (alive) setThisShared(true);
      } catch {
        if (alive) setThisShared(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareUrl]);

  // 读取整柜公开状态
  useEffect(() => {
    isWardrobePublic(shareUrlUid(shareUrl))
      .then(setWardrobePublicState)
      .catch(() => setWardrobePublicState(false));
  }, [shareUrl]);

  const handleUnshareThis = async () => {
    setTogglingThis(true);
    try {
      if (target.kind === 'item') {
        const stillReferenced = await isItemReferencedByOtherSharedMatches(target.item.id);
        if (stillReferenced) {
          alert('这件单品仍被一套已公开的搭配引用。请先取消那套搭配的分享，或保留这件单品公开。');
          return;
        }
        await setItemShared(target.item.id, false);
      } else {
        await setMatchShared(target.match, false, allMatches);
      }
      setThisShared(false);
    } catch {
      alert('操作失败，请重试');
    } finally {
      setTogglingThis(false);
    }
  };

  const handleReshareThis = async () => {
    setTogglingThis(true);
    try {
      if (target.kind === 'item') await setItemShared(target.item.id, true);
      else await setMatchShared(target.match, true, allMatches);
      setThisShared(true);
    } catch {
      alert('操作失败，请重试');
    } finally {
      setTogglingThis(false);
    }
  };

  const handleToggleWardrobe = async () => {
    const next = !wardrobePublic;
    setTogglingWardrobe(true);
    try {
      await setWardrobePublic(next);
      setWardrobePublicState(next);
    } catch {
      alert('操作失败，请重试');
    } finally {
      setTogglingWardrobe(false);
    }
  };

  const fileName = () =>
    target.kind === 'item'
      ? `wearlog-${(target.item.name || 'item').slice(0, 12)}.png`
      : `wearlog-${(target.match.name || 'outfit').slice(0, 12)}.png`;

  const renderPng = async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    return toPng(cardRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      width: CAPTURE_WIDTH,
      backgroundColor: '#DDD8CC',
    });
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const url = await renderPng();
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName();
      a.click();
    } catch (e) {
      console.error(e);
      alert('生成图片失败，请重试');
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    setGenerating(true);
    try {
      const url = await renderPng();
      if (!url) return;
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], fileName(), { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], text: shareUrl });
      } else {
        // 不支持分享文件：退化为下载
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName();
        a.click();
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-6 px-4"
      onClick={onClose}
    >
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-tag text-[10px] uppercase tracking-[0.25em] text-tag/90">分享卡片</p>
          <button
            onClick={onClose}
            className="p-2 text-tag/70 hover:text-tag transition-colors border border-tag/20 bg-black/20 hover:bg-black/30"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── 截图卡片 ── */}
        <div className="mx-auto" style={{ width: CAPTURE_WIDTH, maxWidth: '100%' }}>
          <div
            ref={cardRef}
            style={{ width: CAPTURE_WIDTH }}
            className="bg-kraft px-6 pt-6 pb-5"
          >
            {/* 顶部 wordmark */}
            <div className="text-center mb-5">
              <p className="font-tag font-bold text-ink tracking-[0.08em]" style={{ fontSize: '1.05rem' }}>
                衣LOG
              </p>
              <p className="font-story text-[11px] text-graphite/70 italic mt-0.5">
                每一件衣服都有它的故事
              </p>
            </div>

            {/* 主体 */}
            {target.kind === 'item' ? (
              <SharedItemCard item={target.item} />
            ) : (
              <BestMatchShareBody match={target.match} entries={target.entries} />
            )}

            {/* 底部 footer：二维码 + 短链 */}
            <div className="flex items-center gap-4 mt-6 pt-5 border-t border-dashed border-graphite/30">
              {qrDataUrl && (
                <img src={qrDataUrl} alt="QR" className="w-16 h-16 shrink-0 border border-graphite/15 bg-tag" />
              )}
              <div className="min-w-0">
                <p className="font-tag text-[8px] uppercase tracking-[0.2em] text-graphite/55 mb-1">
                  扫码 / 打开链接查看
                </p>
                <p className="font-tag text-[10px] text-ink/75 break-all leading-snug">{shortUrl}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── 操作区 ── */}
        <div className="mt-5 space-y-3">
          {/* 这一条的公开状态 */}
          <div className="rounded-lg border border-dashed border-tag/30 bg-black/20 px-4 py-3">
            {thisShared === null ? (
              <p className="font-story text-[13px] text-tag/70 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> 正在生成可分享链接…
              </p>
            ) : thisShared ? (
              <div className="flex items-center justify-between gap-3">
                <p className="font-story text-[13px] text-tag/85 flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-stamp" />
                  {target.kind === 'item' ? '这件已可被链接公开访问' : '这套搭配已可被链接公开访问'}
                </p>
                <button
                  onClick={handleUnshareThis}
                  disabled={togglingThis}
                  className="shrink-0 inline-flex items-center gap-1.5 font-tag text-[10px] uppercase tracking-wider text-tag/60 hover:text-tag transition-colors disabled:opacity-50"
                >
                  {togglingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <EyeOff className="w-3 h-3" />}
                  取消分享
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="font-story text-[13px] text-tag/70">已取消分享，链接暂时打不开</p>
                <button
                  onClick={handleReshareThis}
                  disabled={togglingThis}
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 py-1.5 bg-stamp text-white font-tag text-[10px] uppercase tracking-wider font-bold hover:bg-stamp/90 transition-colors disabled:opacity-50"
                >
                  {togglingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />}
                  重新分享
                </button>
              </div>
            )}
          </div>

          {/* 整柜公开（可选） */}
          <button
            onClick={handleToggleWardrobe}
            disabled={togglingWardrobe || wardrobePublic === null}
            className="w-full flex items-center gap-3 rounded-lg border border-dashed border-tag/30 bg-black/20 px-4 py-3 text-left hover:bg-black/30 transition-colors disabled:opacity-60"
          >
            <span
              className={`w-5 h-5 shrink-0 border flex items-center justify-center transition-colors ${
                wardrobePublic ? 'bg-stamp border-stamp' : 'border-tag/40'
              }`}
            >
              {togglingWardrobe ? (
                <Loader2 className="w-3 h-3 animate-spin text-tag" />
              ) : wardrobePublic ? (
                <Check className="w-3.5 h-3.5 text-white" />
              ) : null}
            </span>
            <span className="min-w-0">
              <span className="font-story text-[13px] text-tag/90 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 shrink-0" /> 公开我的整个衣柜
              </span>
              <span className="font-story text-[11px] text-tag/55 block mt-0.5">
                勾选后，别人可浏览你的全部单品与搭配；可随时取消。
              </span>
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={generating}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-ink text-tag font-tag text-[11px] uppercase tracking-wider font-bold hover:bg-ink/85 transition-colors disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              保存图片
            </button>
            <button
              onClick={handleShare}
              disabled={generating}
              className="flex items-center justify-center gap-2 px-5 py-3 border border-tag/30 bg-black/20 text-tag font-tag text-[11px] uppercase tracking-wider font-bold hover:bg-black/30 transition-colors disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" />
              分享
            </button>
            <button
              onClick={copyLink}
              className="flex items-center justify-center gap-2 px-4 py-3 border border-tag/30 bg-black/20 text-tag font-tag text-[11px] uppercase tracking-wider font-bold hover:bg-black/30 transition-colors"
              title="复制链接"
            >
              {copied ? <Check className="w-4 h-4 text-stamp" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 从 share url 反解出 uid（/share/:uid/...） */
function shareUrlUid(url: string): string {
  const m = url.match(/\/share\/([^/]+)/);
  return m ? m[1] : '';
}

function BestMatchShareBody({ match, entries }: { match: BestMatch; entries: BundleEntry[] }) {
  return (
    <div className="bg-tag/60 border border-graphite/20 p-5">
      <div className="flex flex-col items-center">
        {match.photoBase64 ? (
          <div className="border border-graphite/20 p-2 bg-white/50 w-full max-w-[260px]">
            <img
              src={resolveMediaUrl(match.photoBase64)}
              alt={match.name || 'outfit'}
              className="w-full"
              style={{ filter: 'contrast(0.97) saturate(0.92) brightness(1.02)' }}
            />
          </div>
        ) : entries.length > 0 ? (
          <TagBundle entries={entries} size="mini" variant="stacked" />
        ) : (
          <p className="font-story italic text-graphite/50 py-10">空搭配</p>
        )}
      </div>

      {match.name && (
        <h2
          className="text-center text-ink mt-4 leading-tight"
          style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300, fontSize: '1.7rem' }}
        >
          {match.name}
        </h2>
      )}

      {(match.sceneTags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center mt-3">
          {match.sceneTags!.map((tag) => (
            <span key={tag} className="px-2.5 py-0.5 font-tag text-[10px] uppercase tracking-wider text-ink border border-ink/30 bg-ink/5">
              {tag}
            </span>
          ))}
        </div>
      )}

      {match.story && (
        <p className="font-story text-[13px] leading-[1.9] text-ink/80 mt-4 whitespace-pre-wrap text-center line-clamp-4">
          {match.story}
        </p>
      )}
    </div>
  );
}
