import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowUpRight } from 'lucide-react';
import { useWardrobe } from '../contexts/WardrobeContext';
import { sfx } from '../lib/sounds';

/**
 * 试用反馈邀请弹窗 —— 在用户对核心功能有一定使用后（加满 N 件衣物），
 * 在首页优雅地邀请填写飞书反馈表单。克制、可稍后、点过即不再打扰。
 */

// 飞书公开表单链接（开启「任何人可填写」后复制的 /share/base/form/... 链接）
const FEEDBACK_FORM_URL: string = '';

const LS_KEY = 'wearlog-feedback-v1';
const MIN_ITEMS = 3;                       // 加满 3 件 = 真正用过核心功能
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // 「稍后」后 3 天再有资格
const SHOW_DELAY_MS = 1200;                // 命中后延迟淡入，不突兀

function isEligible(): boolean {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (!v) return true;
    if (v === 'done') return false;
    if (v.startsWith('snooze:')) {
      const ts = Number(v.slice('snooze:'.length));
      return !Number.isFinite(ts) || Date.now() - ts > SNOOZE_MS;
    }
    return true;
  } catch {
    return false;
  }
}

function setLS(value: string) {
  try { localStorage.setItem(LS_KEY, value); } catch { /* ignore */ }
}

export function FeedbackPrompt() {
  const { items, loading } = useWardrobe();
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  const onHome = location.pathname === '/';
  const meetsUsage = !loading && items.length >= MIN_ITEMS;

  useEffect(() => {
    if (!FEEDBACK_FORM_URL) return;
    if (!onHome || !meetsUsage || !isEligible()) return;
    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [onHome, meetsUsage]);

  if (!FEEDBACK_FORM_URL) return null;

  const goFill = () => {
    sfx.modalOpen();
    window.open(FEEDBACK_FORM_URL, '_blank', 'noopener');
    setLS('done');
    setVisible(false);
  };

  const snooze = () => {
    setLS('snooze:' + Date.now());
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={snooze}
        >
          <motion.div
            className="relative w-full max-w-sm bg-kraft border border-dashed border-graphite/30 shadow-2xl px-7 py-8 text-center"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={snooze}
              className="absolute top-3 right-3 p-1.5 text-graphite/50 hover:text-ink transition-colors"
              aria-label="稍后再说"
            >
              <X className="w-4 h-4" />
            </button>

            <p className="font-tag text-[9px] uppercase tracking-[0.3em] text-graphite/45 mb-3">
              Feedback
            </p>
            <h3 className="font-story font-bold text-2xl text-ink mb-3 leading-snug">
              你的几句话，<br />会让它更好
            </h3>
            <p className="font-story text-[14px] text-graphite/75 leading-relaxed mb-7">
              衣LOG 还很早期。花 1 分钟说说你是谁、从哪来、用下来的感受，
              会帮我把它做得更对。
            </p>

            <button
              onClick={goFill}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-stamp text-white font-tag text-[12px] uppercase tracking-wider font-bold hover:bg-stamp/90 transition-colors shadow-sm"
            >
              去填问卷
              <ArrowUpRight className="w-4 h-4" />
            </button>
            <button
              onClick={snooze}
              className="mt-3 w-full font-tag text-[10px] uppercase tracking-[0.2em] text-graphite/55 hover:text-ink transition-colors"
            >
              稍后再说
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
