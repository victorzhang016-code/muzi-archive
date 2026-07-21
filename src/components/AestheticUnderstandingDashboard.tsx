import { useEffect, useMemo, useState } from "react";
import {
  Aperture,
  ChevronRight,
  Compass,
  Eye,
  Network,
  Sparkles,
  Target,
} from "lucide-react";
import {
  buildAestheticAnalysis,
  defaultBodyProfile,
  loadAestheticAnalysisBundle,
  normalizeBodyProfile,
  saveAestheticAnalysisBundle,
  type AestheticAnalysisBundle,
  type AestheticEvidence,
  type BodyProfile,
  type EvidenceLevel,
  type ItemRole,
} from "../lib/aestheticAnalysis";
import type { LocalSnapshot } from "../lib/localAestheticLab";

const roleLabel: Record<ItemRole, string> = {
  anchor: "表达锚点",
  stabilizer: "稳定器",
  bridge: "桥梁",
  accent: "点缀",
  specialist: "场景专才",
  emotional_anchor: "情感锚点",
  unresolved: "待辨认",
};
const roleClass: Record<ItemRole, string> = {
  anchor: "bg-stamp text-white",
  stabilizer: "bg-graphite text-white",
  bridge: "bg-sky-700 text-white",
  accent: "bg-amber-600 text-white",
  specialist: "bg-emerald-700 text-white",
  emotional_anchor: "bg-rose-700 text-white",
  unresolved: "bg-graphite/15 text-graphite",
};
const levelLabel: Record<EvidenceLevel, string> = {
  fact: "事实",
  pattern: "初步模式",
  principle: "稳定原则",
  hypothesis: "待验证",
};
const levelClass: Record<EvidenceLevel, string> = {
  fact: "text-emerald-800 bg-emerald-50",
  pattern: "text-sky-800 bg-sky-50",
  principle: "text-stamp bg-stamp/10",
  hypothesis: "text-amber-800 bg-amber-50",
};
const bodyGoals = [
  "拉长纵向线",
  "平衡肩部",
  "增强利落感",
  "控制体积",
  "强调腰线",
  "保留松弛感",
];
const avoidEffects = [
  "上身显厚重",
  "腿部显短",
  "肩部过于强调",
  "线条过于拘束",
  "设计焦点过多",
];

const bodyDimensions: Array<{
  label: string;
  key: "shoulder" | "torso" | "legs";
  options: string[];
}> = [
  {
    label: "肩部",
    key: "shoulder",
    options: ["未填写", "偏窄", "均衡", "偏宽"],
  },
  { label: "身躯", key: "torso", options: ["未填写", "偏短", "均衡", "偏长"] },
  { label: "腿部", key: "legs", options: ["未填写", "偏短", "均衡", "偏长"] },
];

function toggle(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

function EvidenceDrawer({
  bundle,
  evidenceIds,
}: {
  bundle: AestheticAnalysisBundle;
  evidenceIds: string[];
}) {
  const entries = evidenceIds
    .map((id) => bundle.evidence.find((entry) => entry.id === id))
    .filter((entry): entry is AestheticEvidence => !!entry)
    .slice(0, 8);
  if (!entries.length)
    return (
      <p className="mt-3 text-xs text-graphite/55">
        当前结论还没有可展示的来源条目。
      </p>
    );
  return (
    <div className="mt-3 space-y-2 border-t border-dashed border-graphite/20 pt-3">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="border-l-2 border-graphite/25 pl-3 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{entry.label}</span>
            <span className="rounded bg-graphite/10 px-1.5 py-0.5 text-[10px] text-graphite/70">
              {entry.status === "proposed" ? "proposed · 0.55" : entry.status}
            </span>
          </div>
          {entry.quote && (
            <p className="mt-1 leading-relaxed text-graphite/70">
              “{entry.quote}”
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function RoleNetwork({
  bundle,
  onSelectItem,
}: {
  bundle: AestheticAnalysisBundle;
  onSelectItem?: (id: string) => void;
}) {
  const nodes = bundle.itemProfiles
    .filter((profile) => !profile.roles.includes("unresolved"))
    .slice(0, 10);
  const visibleIds = new Set(nodes.map((node) => node.itemId));
  const edges = bundle.relations
    .filter(
      (relation) =>
        visibleIds.has(relation.leftItemId) &&
        visibleIds.has(relation.rightItemId),
    )
    .slice(0, 18);
  const points = new Map(
    nodes.map((node, index) => {
      const angle =
        (Math.PI * 2 * index) / Math.max(nodes.length, 1) - Math.PI / 2;
      return [
        node.itemId,
        { x: 50 + Math.cos(angle) * 38, y: 50 + Math.sin(angle) * 36 },
      ];
    }),
  );
  if (!nodes.length)
    return (
      <p className="p-6 text-sm text-graphite/60">
        等更多单品拥有确认视觉字段、评分或 Best Match
        角色后，关系网络会在这里出现。
      </p>
    );
  return (
    <div className="relative min-h-72 overflow-hidden bg-white/45">
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
      >
        {edges.map((edge) => {
          const left = points.get(edge.leftItemId);
          const right = points.get(edge.rightItemId);
          return left && right ? (
            <line
              key={edge.id}
              x1={left.x}
              y1={left.y}
              x2={right.x}
              y2={right.y}
              stroke={edge.kind === "slot_variant_of" ? "#c8462d" : "#6d6d68"}
              strokeWidth={edge.kind === "slot_variant_of" ? 0.7 : 0.35}
              strokeDasharray={
                edge.kind === "slot_variant_of" ? "2 1.5" : undefined
              }
              opacity="0.55"
            />
          ) : null;
        })}
      </svg>
      {nodes.map((node) => {
        const point = points.get(node.itemId)!;
        const size = 30 + Math.min(node.roleScore, 100) * 0.24;
        const role = node.roles[0];
        return (
          <button
            type="button"
            key={node.itemId}
            onClick={() => onSelectItem?.(node.itemId)}
            title={`${node.itemName} · ${roleLabel[role]}`}
            className={`absolute z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-kraft text-center text-[10px] leading-tight shadow-md transition hover:scale-110 ${roleClass[role]}`}
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
              width: size,
              height: size,
            }}
          >
            <span className="line-clamp-2 px-1">{node.itemName}</span>
          </button>
        );
      })}
    </div>
  );
}

function CompositionCanvas({ bundle }: { bundle: AestheticAnalysisBundle }) {
  const [selected, setSelected] = useState(bundle.outfits[0]?.matchId || "");
  const outfit =
    bundle.outfits.find((entry) => entry.matchId === selected) ||
    bundle.outfits[0];
  if (!bundle.outfits.length)
    return (
      <p className="p-6 text-sm text-graphite/60">
        导入 Best Match 后，搭配语法画布会显示每套搭配的表达强度与结构复杂度。
      </p>
    );
  return (
    <div>
      <div className="relative h-72 overflow-hidden border border-graphite/15 bg-white/45">
        <span className="absolute bottom-2 left-3 text-[10px] text-graphite/55">
          稳定 / 克制
        </span>
        <span className="absolute bottom-2 right-3 text-[10px] text-graphite/55">
          表达 / 戏剧化
        </span>
        <span className="absolute left-3 top-3 text-[10px] text-graphite/55">
          多层次 / 强焦点
        </span>
        <span className="absolute left-3 bottom-7 text-[10px] text-graphite/55">
          基础承接
        </span>
        <div className="absolute inset-x-10 top-1/2 border-t border-dashed border-graphite/20" />
        <div className="absolute bottom-8 top-8 left-1/2 border-l border-dashed border-graphite/20" />
        {bundle.outfits.map((entry) => (
          <button
            type="button"
            key={entry.matchId}
            onClick={() => setSelected(entry.matchId)}
            title={entry.name}
            className={`absolute grid h-9 w-9 -translate-x-1/2 translate-y-1/2 place-items-center rounded-full border-2 text-[10px] shadow transition hover:scale-110 ${selected === entry.matchId ? "border-stamp bg-stamp text-white" : "border-ink bg-kraft text-ink"}`}
            style={{
              left: `${12 + entry.expression * 0.76}%`,
              bottom: `${12 + entry.complexity * 0.7}%`,
            }}
          >
            {entry.scenes[0]?.slice(0, 1) || "搭"}
          </button>
        ))}
      </div>
      {outfit && (
        <div className="mt-3 grid gap-3 border-t border-dashed border-graphite/20 pt-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-graphite/55">当前搭配</p>
            <p className="mt-1 text-sm font-medium">{outfit.name}</p>
            <p className="mt-1 text-xs text-graphite/65">
              表达 {outfit.expression} · 结构 {outfit.complexity} · 证据可靠度{" "}
              {outfit.reliability}%
            </p>
          </div>
          <div>
            <p className="text-xs text-graphite/55">视觉组成</p>
            <p className="mt-1 text-sm leading-relaxed">
              {[
                ...outfit.silhouetteLabels,
                ...outfit.styleLabels,
                ...outfit.designHighlights,
              ]
                .slice(0, 6)
                .join(" · ") || "待补充 confirmed 视觉字段"}
            </p>
          </div>
          <div>
            <p className="text-xs text-graphite/55">搭配意图原文</p>
            <p className="mt-1 text-sm leading-relaxed">
              {outfit.intentQuotes[0]
                ? `“${outfit.intentQuotes[0]}”`
                : "暂无可直接引用的搭配意图，保留为结构性观察。"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function AestheticUnderstandingDashboard({
  snapshot,
  onSelectItem,
}: {
  snapshot: LocalSnapshot;
  onSelectItem?: (id: string) => void;
}) {
  const persisted = useMemo(() => loadAestheticAnalysisBundle(), []);
  const [bodyProfile, setBodyProfile] = useState<BodyProfile>(
    normalizeBodyProfile(persisted?.bodyProfile || defaultBodyProfile()),
  );
  const bundle = useMemo(
    () => buildAestheticAnalysis(snapshot, bodyProfile),
    [snapshot, bodyProfile],
  );
  const [selectedInsight, setSelectedInsight] = useState(
    bundle.insights[0]?.id || "",
  );
  useEffect(() => {
    saveAestheticAnalysisBundle(bundle);
  }, [bundle]);
  useEffect(() => {
    if (!bundle.insights.some((insight) => insight.id === selectedInsight))
      setSelectedInsight(bundle.insights[0]?.id || "");
  }, [bundle, selectedInsight]);
  const activeInsight =
    bundle.insights.find((insight) => insight.id === selectedInsight) ||
    bundle.insights[0];
  const confirmedCoverage = bundle.coverage.totalVision
    ? Math.round(
        (bundle.coverage.confirmed / bundle.coverage.totalVision) * 100,
      )
    : 0;

  return (
    <section className="space-y-6 border-t border-ink/20 pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-tag text-[10px] tracking-[0.2em] text-stamp">
            AESTHETIC UNDERSTANDING
          </p>
          <h2 className="mt-2 font-story text-3xl font-semibold">
            审美理解总览
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-graphite">
            这是一份派生分析报告：只读取当前快照，不会修改任何 confirmed 或
            proposed 读图记录。每个结论均保留来源、样本量、证据等级和规则版本。
          </p>
        </div>
        <div className="border border-graphite/20 bg-white/45 px-3 py-2 text-right text-xs text-graphite/65">
          <p>引擎：{bundle.engineVersion}</p>
          <p className="mt-1">快照：{bundle.inputSnapshotHash}</p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        {[
          ["已确认字段", bundle.coverage.confirmed],
          ["探索字段", bundle.coverage.proposed],
          ["Best Match", bundle.coverage.bestMatches],
          ["confirmed 覆盖", `${confirmedCoverage}%`],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="border border-graphite/20 bg-white/45 p-4"
          >
            <p className="text-xs text-graphite/60">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="border border-graphite/20 bg-white/35 p-5">
        <div className="flex items-start gap-3">
          <Target className="mt-0.5 h-5 w-5 text-stamp" />
          <div>
            <h3 className="font-story text-xl font-semibold">
              我的身形与穿衣感受
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-graphite/65">
              用你自己的话描述比例感知、想强调或避开的效果、舒适度与真实穿着验证。系统只引用这段文字，不会从图片推断身体条件。
            </p>
          </div>
        </div>
        <textarea
          value={bodyProfile.description}
          onChange={(event) =>
            setBodyProfile((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          placeholder="例如：我希望上身看起来更利落，避免肩部显得太厚；我喜欢有纵向线条的搭配，但不想把腰线收得太紧。白色伞兵裤实际穿着能拉长比例，这一点已经确认。"
          rows={5}
          className="mt-4 w-full resize-y border border-graphite/25 bg-white/70 px-3 py-3 text-sm leading-relaxed text-ink outline-none focus:border-stamp"
        />
        <p className="mt-2 text-[11px] text-graphite/55">
          这段文字会保存到本地审美分析包，并作为待验证身形解释的唯一人工输入。
        </p>
        <div className="mt-4 hidden grid gap-3 sm:grid-cols-3">
          {[
            ["肩部", "shoulder", ["未填写", "偏窄", "均衡", "偏宽"]],
            ["躯干", "torso", ["未填写", "偏短", "均衡", "偏长"]],
            ["腿部", "legs", ["未填写", "偏短", "均衡", "偏长"]],
          ].map(([label, key, options]) => (
            <label key={String(key)} className="text-xs text-graphite/65">
              <span>{label}</span>
              <select
                value={
                  bodyProfile[
                    key as keyof Pick<
                      BodyProfile,
                      "shoulder" | "torso" | "legs"
                    >
                  ]
                }
                onChange={(event) =>
                  setBodyProfile((current) => ({
                    ...current,
                    [key as string]: event.target.value,
                  }))
                }
                className="mt-1 w-full border border-graphite/20 bg-white/75 px-2 py-2 text-sm text-ink"
              >
                {(options as string[]).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="mt-4 hidden grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs text-graphite/65">希望强化</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {bodyGoals.map((goal) => (
                <button
                  type="button"
                  key={goal}
                  onClick={() =>
                    setBodyProfile((current) => ({
                      ...current,
                      goals: toggle(current.goals, goal),
                    }))
                  }
                  className={`border px-2 py-1 text-xs ${bodyProfile.goals.includes(goal) ? "border-stamp bg-stamp text-white" : "border-graphite/20 bg-white/60"}`}
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-graphite/65">希望避免</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {avoidEffects.map((effect) => (
                <button
                  type="button"
                  key={effect}
                  onClick={() =>
                    setBodyProfile((current) => ({
                      ...current,
                      avoidEffects: toggle(current.avoidEffects, effect),
                    }))
                  }
                  className={`border px-2 py-1 text-xs ${bodyProfile.avoidEffects.includes(effect) ? "border-stamp bg-stamp text-white" : "border-graphite/20 bg-white/60"}`}
                >
                  {effect}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-stamp" />
          <div>
            <h3 className="font-story text-2xl font-semibold">
              你的审美操作系统
            </h3>
            <p className="mt-1 text-xs text-graphite/65">
              这里优先展示有组合证据的原则，不把单词、频率或基础款误读为审美本体。
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          {" "}
          <div className="grid gap-3">
            {bundle.insights.map((insight) => (
              <button
                type="button"
                key={insight.id}
                onClick={() => setSelectedInsight(insight.id)}
                className={`border p-4 text-left transition ${selectedInsight === insight.id ? "border-stamp bg-stamp/[0.05]" : "border-graphite/20 bg-white/35 hover:border-stamp/50"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`rounded px-2 py-1 text-[10px] ${levelClass[insight.level]}`}
                  >
                    {levelLabel[insight.level]}
                  </span>
                  <span className="text-[10px] text-graphite/55">
                    支持 {insight.supportCount} · confirmed{" "}
                    {insight.confirmedCount} · proposed {insight.proposedCount}
                  </span>
                </div>
                <h4 className="mt-3 font-story text-lg font-semibold">
                  {insight.title}
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-graphite">
                  {insight.body}
                </p>
                {insight.action && (
                  <p className="mt-2 text-xs text-stamp">
                    下一步：{insight.action}
                  </p>
                )}
              </button>
            ))}
          </div>
          <aside className="border border-graphite/20 bg-white/45 p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-stamp" />
              <h4 className="font-story text-lg font-semibold">证据检查器</h4>
            </div>
            {activeInsight ? (
              <>
                <p className="mt-3 text-sm font-medium">
                  {activeInsight.title}
                </p>
                <EvidenceDrawer
                  bundle={bundle}
                  evidenceIds={activeInsight.evidenceIds}
                />
              </>
            ) : (
              <p className="mt-3 text-sm text-graphite/60">
                数据不足时不会伪造洞察。
              </p>
            )}
          </aside>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="border border-graphite/20 bg-white/35 p-5">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-stamp" />
            <h3 className="font-story text-xl font-semibold">搭配语法画布</h3>
          </div>
          <p className="mt-1 text-xs text-graphite/65">
            横向是表达强度，纵向是结构复杂度；节点边框表示视觉证据可靠度。
          </p>
          <div className="mt-4">
            <CompositionCanvas bundle={bundle} />
          </div>
        </div>
        <div className="border border-graphite/20 bg-white/35 p-5">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-stamp" />
            <h3 className="font-story text-xl font-semibold">单品角色网络</h3>
          </div>
          <p className="mt-1 text-xs text-graphite/65">
            节点大小来自综合偏好、搭配支持、视觉签名和叙事证据；虚线代表上下文槽位变体。
          </p>
          <div className="mt-4">
            <RoleNetwork bundle={bundle} onSelectItem={onSelectItem} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                "anchor",
                "stabilizer",
                "bridge",
                "accent",
                "specialist",
                "emotional_anchor",
              ] as ItemRole[]
            ).map((role) => (
              <span
                key={role}
                className={`rounded px-2 py-1 text-[10px] ${roleClass[role]}`}
              >
                {roleLabel[role]}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {bundle.dimensions.map((dimension) => (
          <article
            key={dimension.id}
            className="border border-graphite/20 bg-white/35 p-4"
          >
            <h3 className="font-story text-lg font-semibold">
              {dimension.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-graphite">
              {dimension.summary}
            </p>
            <div className="mt-4 h-1.5 overflow-hidden bg-graphite/10">
              <div
                className="h-full bg-emerald-700"
                style={{ width: `${dimension.confirmedCoverage}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-graphite/55">
              confirmed 覆盖 {dimension.confirmedCoverage}% · proposed 覆盖{" "}
              {dimension.proposedCoverage}%
            </p>
          </article>
        ))}
      </section>

      <section className="border border-graphite/20 bg-white/35 p-5">
        <h3 className="font-story text-xl font-semibold">张力与待开发</h3>
        <p className="mt-1 text-xs text-graphite/65">
          它们是下一步值得试验或校对的方向，不是未经验证的系统推荐。
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {bundle.opportunities.length ? (
            bundle.opportunities.map((opportunity) => (
              <button
                type="button"
                key={opportunity.id}
                onClick={() =>
                  opportunity.itemId && onSelectItem?.(opportunity.itemId)
                }
                className="border border-dashed border-graphite/25 bg-white/50 p-3 text-left hover:border-stamp"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-1 text-[10px] ${levelClass[opportunity.level]}`}
                  >
                    {levelLabel[opportunity.level]}
                  </span>
                  <span className="font-medium text-sm">
                    {opportunity.title}
                  </span>
                  <ChevronRight className="ml-auto h-4 w-4 text-graphite/45" />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-graphite">
                  {opportunity.body}
                </p>
              </button>
            ))
          ) : (
            <p className="text-sm text-graphite/60">
              当前没有足够证据形成待开发清单。
            </p>
          )}
        </div>
      </section>
    </section>
  );
}
