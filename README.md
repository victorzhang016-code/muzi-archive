# 衣LOG（wearlog）

衣LOG 是 Victor 的个人衣物档案 app：记录衣物，也记录人与衣物之间的故事；通过 Best Match 保存“心中的最佳搭配”。历史目录和仓库仍可能出现「模子の衣柜」或 `muzi-archive`，均指同一项目。

线上地址：<https://wear-log.vercel.app>
当前状态：一阶段已完成。详见 [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md)。

## 本地开发

```bash
npm install
npm run dev
```

## 校验

```bash
npm run lint
npm run build
```

## 现行技术栈

- React + TypeScript + Vite
- Supabase Auth + Postgres + RLS/RPC
- Vercel Serverless + Vercel Blob
- Kimi AI relay（`/api/ai-import`）

Firebase 相关依赖和模拟器脚本仍作为迁移兼容遗留保留；新增业务不要重新接回 Firestore。
