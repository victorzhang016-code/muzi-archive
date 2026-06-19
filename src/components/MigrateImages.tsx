import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useBestMatches } from '../contexts/BestMatchContext';
import { uploadImageToBlob } from '../lib/blobUpload';
import { Loader2, UploadCloud, Check } from 'lucide-react';

/**
 * 一次性「把我的图片迁到新存储」按钮（Phase 3）。
 *
 * 只在当前用户还有 base64 老图时显示。逐张：把已在内存里的 base64（来自实时监听，0 额外读）
 * 上传到 Blob → 写回 https URL，并把原 base64 备份到 imageUrlBackup/photoBackup（非破坏，可回退）。
 * 上传失败的跳过（原图照常显示，可再点重试）。迁完公开看图就走 Blob CDN，省 Firestore 读、发版不清缓存。
 */
export function MigrateImages() {
  const { items } = useWardrobe();
  const { matches } = useBestMatches();
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const pendingItems = items.filter(
    (i) => typeof i.imageUrl === 'string' && i.imageUrl.startsWith('data:')
  );
  const pendingMatches = matches.filter(
    (m) => typeof m.photoBase64 === 'string' && m.photoBase64.startsWith('data:')
  );
  const total = pendingItems.length + pendingMatches.length;

  if (!migrating && !doneMsg && total === 0) return null;

  const run = async () => {
    setMigrating(true);
    setDoneMsg(null);
    const grandTotal = total;
    setProgress({ done: 0, total: grandTotal });
    let done = 0;
    let failed = 0;

    for (const it of pendingItems) {
      try {
        const url = await uploadImageToBlob(it.imageUrl!);
        await updateDoc(doc(db, 'wardrobe_items', it.id), {
          imageUrl: url,
          imageUrlBackup: it.imageUrl,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.error('[migrate] item failed', it.id, e);
        failed++;
      }
      setProgress({ done: ++done, total: grandTotal });
    }

    for (const m of pendingMatches) {
      try {
        const url = await uploadImageToBlob(m.photoBase64!);
        await updateDoc(doc(db, 'best_matches', m.id), {
          photoBase64: url,
          photoBackup: m.photoBase64,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.error('[migrate] match failed', m.id, e);
        failed++;
      }
      setProgress({ done: ++done, total: grandTotal });
    }

    setMigrating(false);
    setDoneMsg(
      failed === 0
        ? `已把 ${done} 张图片迁到新存储 ✓ 加载更快、更省额度`
        : `迁移完成：${done - failed} 张成功，${failed} 张未成功（原图仍在，可稍后再点一次）`
    );
  };

  return (
    <div className="mb-8 rounded-xl border border-graphite/25 bg-tag/40 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0">
        {doneMsg ? (
          <p className="font-story text-ink text-[14px] flex items-center gap-2">
            <Check className="w-4 h-4 text-stamp shrink-0" /> {doneMsg}
          </p>
        ) : (
          <>
            <p className="font-story text-ink text-[15px] font-semibold">把图片迁到新存储</p>
            <p className="font-story text-graphite/70 text-[13px] mt-0.5">
              {migrating
                ? `迁移中… ${progress.done}/${progress.total}`
                : `还有 ${total} 张图片在用旧存储。迁过去后加载更快、更省额度（原图自动备份，可回退）。`}
            </p>
          </>
        )}
      </div>
      {!doneMsg && (
        <button
          onClick={run}
          disabled={migrating}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-ink text-white font-tag text-[12px] uppercase tracking-wider font-bold hover:bg-ink/90 transition-colors disabled:opacity-50"
        >
          {migrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
          {migrating ? '迁移中…' : '开始迁移'}
        </button>
      )}
    </div>
  );
}
