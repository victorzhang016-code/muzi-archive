import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import { X, Download, Share2, Loader2, Check, Copy } from 'lucide-react';
import { BestMatch, WardrobeItem } from '../types';
import type { BundleEntry } from './TagBundle';
import { TagBundle } from './TagBundle';
import { SharedItemCard } from './SharedItemCard';
import { isSharingEnabled, setSharingEnabled } from '../lib/sharing';

export type ShareTarget =
  | { kind: 'item'; item: WardrobeItem }
  | { kind: 'bestMatch'; match: BestMatch; entries: BundleEntry[] };

interface Props {
  target: ShareTarget;
  shareUrl: string;
  onClose: () => void;
}

const CAPTURE_WIDTH = 480;

export function ShareCardModal({ target, shareUrl, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [shareReady, setShareReady] = useState<boolean | null>(null); // null = checking
  const [enabling, setEnabling] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const shortUrl = shareUrl.replace(/^https?:\/\//, '');

  useEffect(() => {
    QRCode.toDataURL(shareUrl, { margin: 1, width: 240, color: { dark: '#1C1C1A', light: '#FDFCF5' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [shareUrl]);

  useEffect(() => {
    isSharingEnabled(shareUrlUid(shareUrl))
      .then(setShareReady)
      .catch(() => setShareReady(false));
  }, [shareUrl]);

  const handleEnable = async () => {
    setEnabling(true);
    try {
      await setSharingEnabled(true);
      setShareReady(true);
    } catch {
      alert('开启分享失败，请重试');
    } finally {
      setEnabling(false);
    }
  };

  const fileName = () =>
    target.kind === 'item'
      ? `muzi-${(target.item.name || 'item').slice(0, 12)}.png`
      : `muzi-${(target.match.name || 'outfit').slice(0, 12)}.png`;

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
                模子の衣柜
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
          {shareReady === false && (
            <div className="rounded-lg border border-dashed border-tag/30 bg-black/20 px-4 py-3 text-center">
              <p className="font-story text-[13px] text-tag/85 mb-2">
                生成的链接需要「开启分享」后别人才能打开
              </p>
              <button
                onClick={handleEnable}
                disabled={enabling}
                className="inline-flex items-center gap-2 px-5 py-2 bg-stamp text-white font-tag text-[11px] uppercase tracking-wider font-bold hover:bg-stamp/90 transition-colors disabled:opacity-50"
              >
                {enabling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                开启分享
              </button>
            </div>
          )}

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
              src={match.photoBase64}
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
