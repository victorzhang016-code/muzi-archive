import { useState } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Loader2, CheckCircle } from 'lucide-react';

export function MigrateData() {
  const [oldUid, setOldUid] = useState('');
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');

  const currentUid = auth.currentUser?.uid ?? '';

  const migrate = async () => {
    const trimmed = oldUid.trim();
    if (!trimmed || !auth.currentUser) return;
    if (trimmed === currentUid) {
      setError('旧 UID 和当前 UID 相同，无需迁移。');
      return;
    }

    setStatus('running');
    setError('');

    try {
      const q = query(collection(db, 'wardrobe_items'), where('userId', '==', trimmed));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setCount(0);
        setStatus('done');
        return;
      }

      let migrated = 0;
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        await addDoc(collection(db, 'wardrobe_items'), {
          ...data,
          userId: currentUid,
          createdAt: data.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        migrated++;
      }

      setCount(migrated);
      setStatus('done');
    } catch (e: any) {
      setError(e.message ?? '未知错误');
      setStatus('error');
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-16 p-8 bg-tag border border-dashed border-graphite/25">
      <p className="font-tag text-[9px] uppercase tracking-[0.3em] text-graphite/50 mb-1">One-time Tool</p>
      <h2 className="font-story text-2xl font-bold text-ink mb-8">迁移衣柜数据</h2>

      {/* Current UID */}
      <div className="mb-6 p-4 bg-white border border-graphite/15">
        <p className="font-tag text-[8px] uppercase tracking-widest text-graphite/45 mb-1">当前账号 UID（迁移目标）</p>
        <p className="font-mono text-[11px] text-ink break-all select-all">{currentUid}</p>
      </div>

      {/* Old UID input */}
      <div className="mb-2">
        <label className="block font-tag text-[9px] uppercase tracking-[0.2em] text-graphite mb-2">
          旧账号 UID（数据来源）
        </label>
        <input
          type="text"
          value={oldUid}
          onChange={e => setOldUid(e.target.value)}
          disabled={status === 'running' || status === 'done'}
          placeholder="粘贴旧的匿名 UID..."
          className="w-full px-4 py-2.5 bg-white border border-graphite/20 focus:border-ink outline-none font-mono text-xs transition-colors"
        />
      </div>
      <p className="font-tag text-[8px] text-graphite/45 mb-6 leading-relaxed">
        → Firebase Console › Firestore › wardrobe_items › 随便打开一个文档 › 复制 userId 字段的值
      </p>

      {/* Status */}
      {status === 'done' && (
        <div className="mb-4 p-3 flex items-center gap-2 bg-white border border-graphite/20 text-ink">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
          <span className="font-tag text-[10px] uppercase tracking-wider">
            {count > 0 ? `成功迁移 ${count} 件衣物` : '未找到数据（确认旧 UID 是否正确）'}
          </span>
        </div>
      )}
      {status === 'error' && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 text-stamp font-tag text-[10px]">
          {error}
        </div>
      )}

      <button
        onClick={migrate}
        disabled={!oldUid.trim() || status === 'running' || status === 'done'}
        className="w-full py-3 bg-ink text-white font-tag text-[10px] uppercase tracking-widest font-bold hover:bg-ink/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {status === 'running' && <Loader2 className="w-4 h-4 animate-spin" />}
        {status === 'running' ? '迁移中...' : status === 'done' ? '✓ 已完成' : '开始迁移'}
      </button>

      {status === 'done' && count > 0 && (
        <p className="mt-5 font-tag text-[8px] text-graphite/50 text-center leading-relaxed">
          返回首页即可看到数据。<br />
          完成后告诉 Alpha 恢复 Firestore 规则。
        </p>
      )}
    </div>
  );
}
