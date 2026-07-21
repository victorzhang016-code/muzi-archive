import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Check,
  Download,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import {
  analyzeLocalSnapshot,
  emptyLocalPayload,
  loadSourceAccountSnapshot,
  loadLocalSnapshot,
  normalizeLocalSnapshot,
  requestLocalVision,
  requestLocalVisionCorrection,
  saveLocalSnapshot,
  type LocalAnalysis,
  type LocalColor,
  type LocalItem,
  type LocalSnapshot,
  type LocalTag,
  type LocalVisionPayload,
  type RefinableVisionField,
} from "../lib/localAestheticLab";
import { aestheticSourceSupabase } from "../lib/aestheticSourceSupabase";
import { AestheticUnderstandingDashboard } from "./AestheticUnderstandingDashboard";

function commaTags(tags: LocalTag[]) {
  return tags.map((tag) => tag.value).join(", ");
}
function parseTags(value: string): LocalTag[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((value) => ({
      value,
      confidence: 1,
      evidence: "Victor 本地确认",
      source: "user",
    }));
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs text-graphite/70">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border border-graphite/20 bg-white/70 px-2 py-2 text-sm text-ink outline-none focus:border-stamp"
      />
    </label>
  );
}

function rgbToHex(rgb: [number, number, number]) {
  return `#${rgb.map((part) => part.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [0, 1, 2].map((index) =>
    parseInt(clean.slice(index * 2, index * 2 + 2) || "0", 16),
  ) as [number, number, number];
}

function rgbToHsv([red, green, blue]: [number, number, number]): [
  number,
  number,
  number,
] {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta)
    hue =
      max === r
        ? ((g - b) / delta) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4;
  hue = Math.round((hue * 60 + 360) % 360);
  return [hue, max ? delta / max : 0, max];
}

function hsvToRgb(
  hue: number,
  saturation: number,
  value: number,
): [number, number, number] {
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = value - chroma;
  const [r, g, b] =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];
  return [
    Math.round((r + match) * 255),
    Math.round((g + match) * 255),
    Math.round((b + match) * 255),
  ];
}

function ColorField({
  color,
  onChange,
  onRemove,
}: {
  color: LocalColor;
  onChange: (color: LocalColor) => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hue, setHue] = useState(() => rgbToHsv(color.rgb)[0]);
  const [saturation, setSaturation] = useState(() => rgbToHsv(color.rgb)[1]);
  const [value, setValue] = useState(() => rgbToHsv(color.rgb)[2]);
  const surfaceDragging = useRef(false);
  const hueDragging = useRef(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const [nextHue, nextSaturation, nextValue] = rgbToHsv(color.rgb);
    setHue(nextHue);
    setSaturation(nextSaturation);
    setValue(nextValue);
  }, [color.rgb[0], color.rgb[1], color.rgb[2]]);
  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);
  const updateHsv = (
    nextHue: number,
    nextSaturation: number,
    nextValue: number,
  ) => {
    setHue(nextHue);
    setSaturation(nextSaturation);
    setValue(nextValue);
    const rgb = hsvToRgb(nextHue, nextSaturation, nextValue);
    onChange({ ...color, rgb, hex: rgbToHex(rgb), source: "user" });
  };
  const pickSurface = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const nextSaturation = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / rect.width),
    );
    const nextValue = Math.max(
      0,
      Math.min(1, 1 - (event.clientY - rect.top) / rect.height),
    );
    updateHsv(hue, nextSaturation, nextValue);
  };
  const pickHue = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const nextHue = Math.max(
      0,
      Math.min(360, ((event.clientY - rect.top) / rect.height) * 360),
    );
    updateHsv(nextHue, saturation, value);
  };
  const updateRgb = (rgb: [number, number, number]) => {
    const next = rgbToHsv(rgb);
    setHue(next[0]);
    setSaturation(next[1]);
    setValue(next[2]);
    onChange({ ...color, rgb, hex: rgbToHex(rgb), source: "user" });
  };
  const startSurfaceDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    surfaceDragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    pickSurface(event);
  };
  const startHueDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    hueDragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    pickHue(event);
  };
  const stopSurfaceDrag = () => {
    surfaceDragging.current = false;
  };
  const stopHueDrag = () => {
    hueDragging.current = false;
  };
  return (
    <div
      ref={pickerRef}
      className="relative grid grid-cols-[42px_1fr_110px_92px_28px] items-center gap-2 border border-graphite/15 bg-white/50 p-2"
    >
      <button
        type="button"
        aria-label="打开自由色盘"
        onClick={() => setOpen((current) => !current)}
        className="h-8 w-10 cursor-pointer border border-graphite/30 shadow-inner"
        style={{ backgroundColor: color.hex }}
      />
      <input
        aria-label="RGB 数值"
        value={color.rgb.join(",")}
        onChange={(event) => {
          const rgb = event.target.value
            .split(",")
            .map((part) =>
              Math.max(0, Math.min(255, Number(part.trim()) || 0)),
            ) as [number, number, number];
          updateRgb(rgb);
        }}
        className="min-w-0 border border-graphite/20 bg-white/70 px-2 py-1.5 text-xs"
      />
      <span className="text-right font-mono text-[11px] text-graphite/60">
        {color.hex}
      </span>
      <select
        aria-label="颜色角色"
        value={color.role}
        onChange={(event) =>
          onChange({
            ...color,
            role: event.target.value as LocalColor["role"],
            source: "user",
          })
        }
        className="border border-graphite/20 bg-white/70 px-1.5 py-1.5 text-xs"
      >
        <option value="dominant">主色</option>
        <option value="secondary">辅色</option>
        <option value="accent">点缀色</option>
      </select>
      {onRemove ? (
        <button
          type="button"
          aria-label="删除颜色"
          onClick={onRemove}
          className="text-graphite/55 hover:text-stamp"
        >
          ×
        </button>
      ) : (
        <span />
      )}
      {open && (
        <div className="absolute left-0 top-11 z-30 flex w-72 gap-2 border border-graphite/25 bg-kraft p-3 shadow-xl">
          <div className="flex-1">
            <div
              role="slider"
              aria-label="饱和度和明度"
              tabIndex={0}
              onPointerDown={startSurfaceDrag}
              onPointerMove={(event) => {
                if (surfaceDragging.current) pickSurface(event);
              }}
              onPointerUp={stopSurfaceDrag}
              onPointerCancel={stopSurfaceDrag}
              onLostPointerCapture={stopSurfaceDrag}
              className="relative h-44 cursor-crosshair overflow-hidden touch-none"
              style={{
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))`,
              }}
            >
              <span
                className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white shadow"
                style={{
                  left: `${saturation * 100}%`,
                  top: `${(1 - value) * 100}%`,
                }}
              />
            </div>
            <p className="mt-2 text-[10px] text-graphite/60">
              拖动上方区域自由选择饱和度和明度
            </p>
          </div>
          <div className="flex w-5 flex-col">
            <div
              role="slider"
              aria-label="色相"
              tabIndex={0}
              onPointerDown={startHueDrag}
              onPointerMove={(event) => {
                if (hueDragging.current) pickHue(event);
              }}
              onPointerUp={stopHueDrag}
              onPointerCancel={stopHueDrag}
              onLostPointerCapture={stopHueDrag}
              className="relative h-44 cursor-pointer rounded touch-none"
              style={{
                background:
                  "linear-gradient(to bottom, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
              }}
            >
              <span
                className="pointer-events-none absolute left-1/2 h-1 w-7 -translate-x-1/2 -translate-y-1/2 border border-white shadow"
                style={{
                  top: `${(hue / 360) * 100}%`,
                  backgroundColor: "#fff",
                }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-2 top-1 text-xs text-graphite/60"
          >
            完成
          </button>
        </div>
      )}
    </div>
  );
}

function FieldCorrectionPanel({
  item,
  field,
  fieldLabel,
  text,
  suggestions,
  busy,
  onFieldChange,
  onTextChange,
  onRefine,
  onAdopt,
}: {
  item?: LocalItem;
  field: RefinableVisionField;
  fieldLabel: Record<RefinableVisionField, string>;
  text: string;
  suggestions: LocalTag[];
  busy: boolean;
  onFieldChange: (field: RefinableVisionField) => void;
  onTextChange: (text: string) => void;
  onRefine: () => void;
  onAdopt: (suggestion: LocalTag) => void;
}) {
  if (!item) return null;
  return (
    <div className="border border-dashed border-stamp/35 bg-stamp/[0.03] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-story text-lg font-semibold">人工纠正与候选</h3>
          <p className="mt-1 text-xs text-graphite/65">
            知道原结果错了但叫不准时，先写你的概括，再让系统给出可保存的候选。
          </p>
        </div>
        <span className="text-[10px] text-graphite/55">
          当前单品：{item.name}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[150px_1fr_auto]">
        <select
          value={field}
          onChange={(event) =>
            onFieldChange(event.target.value as RefinableVisionField)
          }
          className="border border-graphite/20 bg-white/75 px-2 py-2 text-sm"
        >
          <option value="silhouetteTags">廓形</option>
          <option value="materialTags">材质</option>
          <option value="patternTags">图案</option>
          <option value="styleTags">风格</option>
          <option value="designHighlights">设计亮点</option>
          <option value="visualWeight">视觉重量</option>
          <option value="formality">正式度</option>
        </select>
        <input
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={`例如：${field === "materialTags" ? "机能面料、表面有涂层" : "我认为它不是这个词，实际更接近…"}`}
          className="border border-graphite/20 bg-white/75 px-3 py-2 text-sm outline-none focus:border-stamp"
        />
        <button
          type="button"
          onClick={onRefine}
          disabled={busy}
          className="border border-stamp bg-stamp px-3 py-2 text-xs text-white disabled:opacity-50"
        >
          {busy ? "生成中…" : "给我候选"}
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              type="button"
              key={`${suggestion.value}-${suggestion.evidence}`}
              onClick={() => onAdopt(suggestion)}
              className="border border-graphite/20 bg-white px-3 py-2 text-left text-xs hover:border-stamp"
            >
              <span className="font-medium">{suggestion.value}</span>
              <span className="ml-2 text-graphite/55">采用</span>
              <span className="mt-1 block text-[10px] text-graphite/55">
                {suggestion.evidence || `${fieldLabel[field]}候选`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function LocalAestheticLabPage() {
  const [snapshot, setSnapshot] = useState<LocalSnapshot>(() =>
    loadLocalSnapshot(),
  );
  const [selectedItemId, setSelectedItemId] = useState("");
  const [draft, setDraft] = useState<LocalVisionPayload>(emptyLocalPayload());
  const [busy, setBusy] = useState(false);
  const [refineBusy, setRefineBusy] = useState(false);
  const [refineField, setRefineField] =
    useState<RefinableVisionField>("materialTags");
  const [refineText, setRefineText] = useState("");
  const [refineSuggestions, setRefineSuggestions] = useState<LocalTag[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const analytics = useMemo(() => analyzeLocalSnapshot(snapshot), [snapshot]);
  const selectedItem =
    snapshot.wardrobeItems.find((item) => item.id === selectedItemId) ||
    snapshot.wardrobeItems[0];
  const selectedAnalysis = snapshot.visionAnalyses.find(
    (analysis) => analysis.itemId === selectedItem?.id,
  );
  const setNextSnapshot = (next: LocalSnapshot) => {
    setSnapshot(next);
    saveLocalSnapshot(next);
  };

  useEffect(() => {
    if (!aestheticSourceSupabase) {
      setSessionReady(false);
      return;
    }
    let alive = true;
    void aestheticSourceSupabase.auth.getSession().then(({ data }) => {
      if (alive) setSessionReady(!!data.session);
    });
    const { data } = aestheticSourceSupabase.auth.onAuthStateChange(
      (_event, session) => setSessionReady(!!session),
    );
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  const sourceLogin = async () => {
    if (!aestheticSourceSupabase) {
      setLoginError("只读 Production 数据源未配置");
      return;
    }
    setLoggingIn(true);
    setLoginError("");
    const { error: authError } =
      await aestheticSourceSupabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
    if (authError) setLoginError(authError.message);
    setLoggingIn(false);
  };

  const importSnapshot = async (file: File) => {
    setError("");
    setNotice("");
    try {
      const next = normalizeLocalSnapshot(JSON.parse(await file.text()));
      setNextSnapshot(next);
      setSelectedItemId(next.wardrobeItems[0]?.id || "");
      const firstAnalysis = next.visionAnalyses.find(
        (analysis) => analysis.itemId === next.wardrobeItems[0]?.id,
      );
      setDraft(firstAnalysis?.payload || emptyLocalPayload());
      setNotice(
        `已导入 ${next.wardrobeItems.length} 件单品、${next.bestMatches.length} 套 Best Match`,
      );
    } catch {
      setError("无法读取 JSON 快照，请使用审计台导出的 snapshot 文件");
    }
  };

  const syncAccount = async () => {
    setSyncing(true);
    setError("");
    setNotice("");
    try {
      const remote = await loadSourceAccountSnapshot();
      const localOnlyAnalyses = snapshot.visionAnalyses.filter(
        (analysis) =>
          !remote.visionAnalyses.some(
            (entry) => entry.itemId === analysis.itemId,
          ),
      );
      const next = {
        ...remote,
        visionAnalyses: [...remote.visionAnalyses, ...localOnlyAnalyses],
      };
      setNextSnapshot(next);
      setSelectedItemId(next.wardrobeItems[0]?.id || "");
      const firstAnalysis = next.visionAnalyses.find(
        (analysis) => analysis.itemId === next.wardrobeItems[0]?.id,
      );
      setDraft(firstAnalysis?.payload || emptyLocalPayload());
      setNotice(
        `已从衣 log Production 账号只读同步 ${next.wardrobeItems.length} 件单品、${next.bestMatches.length} 套 Best Match；数据已落到本地。`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "账号同步失败");
    } finally {
      setSyncing(false);
    }
  };

  const analyze = async () => {
    if (!selectedItem?.imageUrl) {
      setError("当前单品没有 imageUrl，先在原应用上传图片或导入带图片的快照");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await requestLocalVision(selectedItem);
      const nextAnalysis: LocalAnalysis = {
        id: selectedAnalysis?.id || `local-${crypto.randomUUID()}`,
        itemId: selectedItem.id,
        status: "proposed",
        modelVersion: result.modelVersion,
        payload: result.payload,
        sourceImageUrl: selectedItem.imageUrl,
        updatedAt: new Date().toISOString(),
      };
      const next = {
        ...snapshot,
        visionAnalyses: [
          nextAnalysis,
          ...snapshot.visionAnalyses.filter(
            (analysis) => analysis.itemId !== selectedItem.id,
          ),
        ],
      };
      setNextSnapshot(next);
      setDraft(result.payload);
      setNotice(
        result.modelVersion === "local-pixel-v1"
          ? "视觉 Provider 当前不可用，已降级为本地 RGB 像素提取；廓形、材质和风格请人工确认。"
          : "读图结果已进入“待确认”，尚未进入正式审美数据",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "本地读图失败");
    } finally {
      setBusy(false);
    }
  };

  const analyzeUnconfirmed = async () => {
    if (batchBusy || busy) return;
    const initial = loadLocalSnapshot();
    const pendingItems = initial.wardrobeItems.filter((item) => {
      if (!item.imageUrl) return false;
      const analysis = initial.visionAnalyses.find(
        (entry) => entry.itemId === item.id,
      );
      // Existing proposed records remain editable in the review panel, but batch
      // reading never overwrites a draft that Victor may already have corrected.
      return !analysis;
    });
    const noImageCount = initial.wardrobeItems.filter(
      (item) => !item.imageUrl,
    ).length;
    if (pendingItems.length === 0) {
      setNotice(
        noImageCount
          ? `没有可自动解析的未确认图片；${noImageCount} 件单品缺少图片，已跳过。`
          : "所有已有读图结果都已确认，无需批量解析。",
      );
      return;
    }
    setBatchBusy(true);
    setBatchProgress({ done: 0, total: pendingItems.length });
    setError("");
    setNotice(
      `开始批量解析 ${pendingItems.length} 件未确认单品，已确认记录不会被改动。`,
    );
    let working = initial;
    let completed = 0;
    const failures: string[] = [];
    for (const item of pendingItems) {
      try {
        const result = await requestLocalVision(item);
        const existing = working.visionAnalyses.find(
          (analysis) => analysis.itemId === item.id,
        );
        const nextAnalysis: LocalAnalysis = {
          id: existing?.id || `local-${crypto.randomUUID()}`,
          itemId: item.id,
          status: "proposed",
          modelVersion: result.modelVersion,
          payload: result.payload,
          sourceImageUrl: item.imageUrl,
          updatedAt: new Date().toISOString(),
        };
        working = normalizeLocalSnapshot({
          ...working,
          visionAnalyses: [
            nextAnalysis,
            ...working.visionAnalyses.filter(
              (analysis) => analysis.itemId !== item.id,
            ),
          ],
        });
        saveLocalSnapshot(working);
        setSnapshot(working);
        if (item.id === selectedItem?.id) setDraft(nextAnalysis.payload);
        completed += 1;
      } catch (cause) {
        failures.push(
          `${item.name || item.id}：${cause instanceof Error ? cause.message : "解析失败"}`,
        );
      } finally {
        setBatchProgress({
          done: completed + failures.length,
          total: pendingItems.length,
        });
      }
    }
    setBatchBusy(false);
    setNotice(
      `批量解析完成：成功 ${completed} 件${failures.length ? `，失败 ${failures.length} 件` : ""}。结果已保留为“待确认”，请逐件修改后确认。`,
    );
    if (failures.length) setError(`以下单品未更新：${failures.join("；")}`);
  };

  const review = (status: "confirmed" | "rejected") => {
    if (
      !selectedItem ||
      !selectedAnalysis ||
      selectedAnalysis.itemId !== selectedItem.id
    ) {
      setError(
        "当前字段没有可靠关联到所选单品，未写入本地数据；请重新选择单品并读图。",
      );
      return;
    }
    const nextAnalysis = {
      ...selectedAnalysis,
      itemId: selectedItem.id,
      status,
      payload: normalizeLocalSnapshot({
        visionAnalyses: [
          { ...selectedAnalysis, itemId: selectedItem.id, payload: draft },
        ],
      }).visionAnalyses[0].payload,
      updatedAt: new Date().toISOString(),
    };
    const nextSnapshot = normalizeLocalSnapshot({
      ...snapshot,
      visionAnalyses: snapshot.visionAnalyses.map((analysis) =>
        analysis.id === selectedAnalysis.id ? nextAnalysis : analysis,
      ),
    });
    setNextSnapshot(nextSnapshot);
    setDraft(nextAnalysis.payload);
    const persisted = loadLocalSnapshot().visionAnalyses.find(
      (analysis) =>
        analysis.id === nextAnalysis.id && analysis.itemId === selectedItem.id,
    );
    if (!persisted || persisted.status !== status) {
      setError("字段已更新但本地快照写入校验失败，请立即导出数据并重试。");
      return;
    }
    setNotice(
      status === "confirmed"
        ? `已确认并写入本地快照：${selectedItem.name}（${selectedItem.id}）。后续统计只读取这条单品关联记录。`
        : `已拒绝并写入本地快照：${selectedItem.name}（${selectedItem.id}）。该记录不会进入正式分析。`,
    );
  };

  const updateTags = (
    key: keyof Pick<
      LocalVisionPayload,
      | "silhouetteTags"
      | "materialTags"
      | "patternTags"
      | "styleTags"
      | "designHighlights"
    >,
    value: string,
  ) => setDraft((current) => ({ ...current, [key]: parseTags(value) }));
  const refineFieldLabel: Record<RefinableVisionField, string> = {
    silhouetteTags: "廓形",
    materialTags: "材质",
    patternTags: "图案",
    styleTags: "风格",
    designHighlights: "设计亮点",
    visualWeight: "视觉重量",
    formality: "正式度",
  };
  const refine = async () => {
    if (!selectedItem || !refineText.trim()) {
      setError("先写下你的人工概括，例如“机能面料”“不是羊毛，表面有涂层”");
      return;
    }
    setRefineBusy(true);
    setError("");
    setRefineSuggestions([]);
    try {
      const result = await requestLocalVisionCorrection(
        selectedItem,
        refineField,
        refineText,
      );
      setRefineSuggestions(result.suggestions || []);
      setNotice(
        result.modelVersion === "manual-correction-v1"
          ? "Provider 暂不可用，已把你的概括作为人工候选；你仍可直接编辑并确认。"
          : "已根据你的人工概括生成候选，请选择一个或继续修改。",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "字段校正失败");
    } finally {
      setRefineBusy(false);
    }
  };
  const adoptSuggestion = (suggestion: LocalTag) => {
    if (refineField === "visualWeight" || refineField === "formality")
      setDraft((current) => ({
        ...current,
        [refineField]: { ...suggestion, source: "user" },
      }));
    else
      setDraft((current) => ({
        ...current,
        [refineField]: [
          ...current[refineField],
          { ...suggestion, source: "user" },
        ],
      }));
    setNotice(
      `已将「${suggestion.value}」加入${refineFieldLabel[refineField]}候选，确认整组字段后才会保存。`,
    );
  };
  const addColor = () =>
    setDraft((current) => {
      if (current.dominantColors.length >= 6) return current;
      const role =
        current.dominantColors.length === 0
          ? "dominant"
          : current.dominantColors.length === 1
            ? "secondary"
            : "accent";
      const rgb: [number, number, number] = [128, 128, 128];
      return {
        ...current,
        dominantColors: [
          ...current.dominantColors,
          {
            rgb,
            hex: rgbToHex(rgb),
            role,
            areaRatio: 0,
            region: "unknown",
            confidence: 1,
            source: "user",
          },
        ],
      };
    });
  const removeColor = (index: number) =>
    setDraft((current) => ({
      ...current,
      dominantColors: current.dominantColors.filter(
        (_, position) => position !== index,
      ),
    }));
  const exportLocal = () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([JSON.stringify(snapshot, null, 2)], {
        type: "application/json",
      }),
    );
    link.download = `wearlog-local-aesthetic-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setNotice("本地分析数据已导出");
  };

  return (
    <div className="min-h-screen bg-kraft px-4 py-8 text-ink sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-dashed border-graphite/25 pb-5">
          <div>
            <p className="font-tag text-[10px] tracking-[0.2em] text-stamp">
              LOCAL AESTHETIC LAB
            </p>
            <h1 className="mt-2 font-story text-3xl font-semibold">
              本地数据分析台
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-graphite">
              从衣 log Production 账号只读同步衣物与 Best
              Match，在本机完成关系统计；不会写回 Production。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void syncAccount()}
              disabled={syncing || sessionReady !== true}
              className="inline-flex items-center gap-2 border border-stamp bg-stamp px-3 py-2 text-xs text-white disabled:opacity-50"
            >
              {syncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              从我的账号同步
            </button>
            <button
              type="button"
              onClick={() => void analyzeUnconfirmed()}
              disabled={
                batchBusy ||
                syncing ||
                !snapshot.wardrobeItems.some(
                  (item) =>
                    item.imageUrl &&
                    !snapshot.visionAnalyses.find(
                      (analysis) => analysis.itemId === item.id,
                    ),
                )
              }
              className="inline-flex items-center gap-2 border border-stamp/60 bg-white/60 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-45"
            >
              {batchBusy
                ? `批量解析 ${batchProgress.done}/${batchProgress.total}`
                : "批量解析未确认"}
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 border border-ink bg-ink px-3 py-2 text-xs text-white"
            >
              <Upload className="h-3.5 w-3.5" />
              导入快照
            </button>
            <button
              type="button"
              onClick={exportLocal}
              className="inline-flex items-center gap-2 border border-graphite/25 bg-white/50 px-3 py-2 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              导出本地数据
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importSnapshot(file);
                event.currentTarget.value = "";
              }}
            />
          </div>
        </header>
        {sessionReady === false && (
          <div className="border border-stamp/25 bg-stamp/5 px-4 py-4 text-sm text-stamp">
            <p>
              本地分析台读取的是衣 log Production
              账号的只读副本。正站登录会话不会跨域共享，请在这里登录一次；不会创建新账号，也不会写入
              Production。
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                type="email"
                autoComplete="email"
                placeholder="衣 log 账号邮箱"
                className="border border-stamp/25 bg-white/70 px-3 py-2 text-sm text-ink outline-none"
              />
              <input
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="密码"
                className="border border-stamp/25 bg-white/70 px-3 py-2 text-sm text-ink outline-none"
              />
              <button
                type="button"
                onClick={() => void sourceLogin()}
                disabled={loggingIn}
                className="border border-stamp bg-stamp px-4 py-2 text-xs text-white disabled:opacity-50"
              >
                {loggingIn ? "登录中…" : "登录数据源"}
              </button>
            </div>
            {loginError && (
              <p className="mt-2 text-xs text-stamp">{loginError}</p>
            )}
          </div>
        )}
        {sessionReady === true && (
          <div className="border border-emerald-700/20 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Production 账号只读会话已就绪，可以同步数据；分析结果仍只保存在
            localhost。
          </div>
        )}
        {notice && (
          <div className="border border-emerald-700/20 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {notice}
          </div>
        )}
        {error && (
          <div className="border border-stamp/25 bg-stamp/5 px-3 py-2 text-sm text-stamp">
            {error}
          </div>
        )}
        <section className="grid gap-3 sm:grid-cols-4">
          {[
            ["单品", analytics.itemCount],
            ["Best Match", analytics.matchCount],
            ["有图片", analytics.imageCount],
            ["已确认读图", analytics.confirmedVisionCount],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="border border-graphite/20 bg-white/40 p-4"
            >
              <p className="text-xs text-graphite/60">{label}</p>
              <p className="mt-2 text-3xl font-semibold">{value}</p>
            </div>
          ))}
        </section>
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <section className="border border-graphite/20 bg-white/35">
            <div className="border-b border-dashed border-graphite/20 px-4 py-3">
              <h2 className="font-story text-lg font-semibold">图片识别字段</h2>
              <p className="mt-1 text-xs text-graphite/60">
                选中单品，读图，再逐字段确认
              </p>
            </div>
            <div className="max-h-[650px] overflow-y-auto">
              {snapshot.wardrobeItems.length === 0 ? (
                <div className="p-5 text-sm text-graphite/65">
                  请先导入审计快照。
                </div>
              ) : (
                snapshot.wardrobeItems.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setSelectedItemId(item.id);
                      const analysis = snapshot.visionAnalyses.find(
                        (entry) => entry.itemId === item.id,
                      );
                      setDraft(analysis?.payload || emptyLocalPayload());
                    }}
                    className={`flex w-full items-center gap-3 border-b border-dashed border-graphite/15 p-3 text-left ${selectedItem?.id === item.id ? "bg-stamp/5" : ""}`}
                  >
                    <div className="h-12 w-10 shrink-0 overflow-hidden border border-graphite/15 bg-white/50">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="m-3 h-4 w-4 text-graphite/40" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.name}
                      </p>
                      <p className="mt-1 truncate text-xs text-graphite/55">
                        {item.category || "未分类"}{" "}
                        {item.brand ? `· ${item.brand}` : ""}
                      </p>
                    </div>
                    <span className="text-[10px] text-graphite/55">
                      {snapshot.visionAnalyses.find(
                        (entry) => entry.itemId === item.id,
                      )?.status || "未读图"}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
          <section className="space-y-6">
            <div className="border border-graphite/20 bg-white/35 p-5">
              {selectedItem ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-graphite/55">当前单品</p>
                      <h2 className="mt-1 font-story text-2xl font-semibold">
                        {selectedItem.name}
                      </h2>
                      <p className="mt-1 text-xs text-graphite/60">
                        {selectedItem.category || "未分类"}{" "}
                        {selectedItem.brand ? `· ${selectedItem.brand}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void analyze()}
                      disabled={busy}
                      className="inline-flex items-center gap-2 bg-ink px-4 py-2 text-xs text-white disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ImageIcon className="h-3.5 w-3.5" />
                      )}
                      {selectedAnalysis ? "重新解析" : "读图"}
                    </button>
                  </div>
                  {selectedItem.imageUrl ? (
                    <img
                      src={selectedItem.imageUrl}
                      alt={selectedItem.name}
                      className="mt-4 h-56 w-full object-contain bg-white/60"
                    />
                  ) : (
                    <div className="mt-4 border border-dashed border-graphite/25 px-4 py-10 text-center text-sm text-graphite/60">
                      没有图片 URL
                    </div>
                  )}
                  {selectedAnalysis && (
                    <div className="mt-5 space-y-4 border-t border-dashed border-graphite/20 pt-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-graphite/60">
                          <span>
                            状态：{selectedAnalysis.status} ·{" "}
                            {selectedAnalysis.modelVersion}
                          </span>
                          <span className="mt-1 block">
                            关联单品：{selectedItem.name} ·{" "}
                            {selectedAnalysis.itemId === selectedItem.id
                              ? "已绑定本地记录"
                              : "关联异常"}
                          </span>
                        </div>
                        {selectedAnalysis.status === "proposed" && (
                          <span className="border border-amber-700/30 bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
                            当前结果可直接修改并确认，确认后才进入正式分析；重新解析会替换当前草稿。
                          </span>
                        )}
                        <span className="text-[10px] text-graphite/50">
                          RGB 必须是 0–255 数组
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field
                          label="廓形"
                          value={commaTags(draft.silhouetteTags)}
                          onChange={(value) =>
                            updateTags("silhouetteTags", value)
                          }
                        />
                        <Field
                          label="材质"
                          value={commaTags(draft.materialTags)}
                          onChange={(value) =>
                            updateTags("materialTags", value)
                          }
                        />
                        <Field
                          label="图案"
                          value={commaTags(draft.patternTags)}
                          onChange={(value) => updateTags("patternTags", value)}
                        />
                        <Field
                          label="风格候选"
                          value={commaTags(draft.styleTags)}
                          onChange={(value) => updateTags("styleTags", value)}
                        />
                        <Field
                          label="设计亮点"
                          value={commaTags(draft.designHighlights)}
                          onChange={(value) =>
                            updateTags("designHighlights", value)
                          }
                        />
                        <Field
                          label="视觉重量"
                          value={draft.visualWeight?.value || ""}
                          onChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              visualWeight: value
                                ? {
                                    value,
                                    confidence: 1,
                                    evidence: "Victor 本地确认",
                                    source: "user",
                                  }
                                : null,
                            }))
                          }
                        />
                        <Field
                          label="正式度"
                          value={draft.formality?.value || ""}
                          onChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              formality: value
                                ? {
                                    value,
                                    confidence: 1,
                                    evidence: "Victor 本地确认",
                                    source: "user",
                                  }
                                : null,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <p className="mb-2 text-xs text-graphite/70">
                          颜色（主色 / 辅色 / 点缀色）·
                          RGB（点击色块打开色盘，也可继续输入数值）
                        </p>
                        <div className="space-y-2">
                          {draft.dominantColors.map((color, index) => (
                            <ColorField
                              key={`color-${index}`}
                              color={color}
                              onChange={(next) =>
                                setDraft((current) => ({
                                  ...current,
                                  dominantColors: current.dominantColors.map(
                                    (entry, position) =>
                                      position === index ? next : entry,
                                  ),
                                }))
                              }
                              onRemove={() => removeColor(index)}
                            />
                          ))}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={addColor}
                            disabled={draft.dominantColors.length >= 6}
                            className="border border-graphite/25 bg-white/60 px-3 py-1.5 text-xs hover:border-stamp disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            ＋ 添加颜色
                          </button>
                          <span className="text-[10px] text-graphite/50">
                            最多 6 个颜色
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => review("confirmed")}
                          className="inline-flex items-center gap-2 bg-emerald-700 px-4 py-2 text-xs text-white"
                        >
                          <Check className="h-3.5 w-3.5" />
                          确认字段
                        </button>
                        <button
                          type="button"
                          onClick={() => review("rejected")}
                          className="inline-flex items-center gap-2 border border-stamp/40 px-4 py-2 text-xs text-stamp"
                        >
                          <X className="h-3.5 w-3.5" />
                          拒绝结果
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-16 text-center text-sm text-graphite/60">
                  导入快照后选择单品
                </div>
              )}
            </div>
            <FieldCorrectionPanel
              item={selectedItem}
              field={refineField}
              fieldLabel={refineFieldLabel}
              text={refineText}
              suggestions={refineSuggestions}
              busy={refineBusy}
              onFieldChange={setRefineField}
              onTextChange={setRefineText}
              onRefine={() => void refine()}
              onAdopt={adoptSuggestion}
            />
            <AestheticUnderstandingDashboard
              snapshot={snapshot}
              onSelectItem={(itemId) => {
                const item = snapshot.wardrobeItems.find(
                  (entry) => entry.id === itemId,
                );
                const analysis = snapshot.visionAnalyses.find(
                  (entry) => entry.itemId === itemId,
                );
                setSelectedItemId(itemId);
                setDraft(analysis?.payload || emptyLocalPayload());
                if (item)
                  setNotice(
                    `已跳转到「${item.name || "未命名单品"}」的视觉字段与证据。`,
                  );
              }}
            />
            {false && (
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="border border-graphite/20 bg-white/35 p-5">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-stamp" />
                    <h2 className="font-story text-lg font-semibold">
                      显性统计
                    </h2>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {[
                      ["品类", analytics.categories],
                      ["品牌", analytics.brands],
                      ["季节", analytics.seasons],
                      ["年份", analytics.years],
                      ["已确认字段", analytics.tags],
                    ].map(([title, entries]) => (
                      <div key={String(title)}>
                        <p className="text-xs text-graphite/60">{title}</p>
                        <div className="mt-2 space-y-1">
                          {(entries as Array<[string, number]>)
                            .slice(0, 6)
                            .map(([key, count]) => (
                              <div
                                key={key}
                                className="flex justify-between gap-2 text-sm"
                              >
                                <span className="truncate">{key}</span>
                                <span className="text-graphite/60">
                                  {count}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border border-graphite/20 bg-white/35 p-5">
                  <h2 className="font-story text-lg font-semibold">
                    关系与结论
                  </h2>
                  <div className="mt-4 space-y-3">
                    {analytics.relations.slice(0, 8).map((relation) => (
                      <div
                        key={`${relation.left}-${relation.right}-${relation.kind}`}
                        className="flex items-center justify-between gap-3 border-b border-dashed border-graphite/15 pb-2 text-sm"
                      >
                        <span className="truncate">
                          {relation.left} × {relation.right}
                        </span>
                        <span className="shrink-0 text-xs text-graphite/60">
                          {relation.kind === "variant" ? "变体" : "共现"}{" "}
                          {relation.count}
                        </span>
                      </div>
                    ))}
                    {analytics.relations.length === 0 && (
                      <p className="text-sm text-graphite/60">
                        导入 Best Match 后，这里会显示共现与变体关系。
                      </p>
                    )}
                  </div>
                  {analytics.insights.map((insight) => (
                    <div
                      key={insight.title}
                      className="mt-4 border-l-2 border-stamp/60 pl-3"
                    >
                      <p className="text-xs text-stamp">{insight.kind}</p>
                      <p className="mt-1 text-sm font-medium">
                        {insight.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-graphite">
                        {insight.body}
                      </p>
                      <p className="mt-1 text-[11px] text-graphite/55">
                        证据：{insight.evidence}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
