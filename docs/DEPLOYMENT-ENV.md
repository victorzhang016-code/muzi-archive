# Supabase / Vercel 环境隔离

这份文档是当前部署变量的唯一约定。Vite 的 `VITE_*` 变量会进入浏览器 bundle，只能放 URL、publishable key 和环境标识；服务端变量不使用 `VITE_*` 兜底。

## 环境矩阵

| 场景 | Vercel 环境 | Supabase 环境 | Supabase 项目 |
|---|---|---|---|
| 本地开发 | 未设置 | `development` | 本地 Supabase，默认 `127.0.0.1:54321` |
| Vercel Preview | `preview` | `development` | 独立的开发 / 测试 Supabase 项目 |
| Vercel Production | `production` | `production` | 独立的生产 Supabase 项目 |

开发环境与生产环境必须是两个 Supabase 项目。不要把生产 URL 或 key 放进 `.env.local`，也不要让 Preview 指向生产项目。

当前项目映射：Preview / Development 使用 `wearlog-dev`（ref `mazsopbfpqchzhyuaron`），Production 使用 `wearlog`（ref `cfnkhilwpkfqebrticqe`）。生产主域名为 `www.wearlog.cn`，`wear-log.vercel.app` 为备用别名。

## Vercel 必填变量

在 Vercel Project Settings → Environment Variables 中，按环境分别设置并重新部署：

### Preview

```text
VITE_VERCEL_ENV=preview
VITE_SUPABASE_ENV=development
VITE_SUPABASE_URL=https://<development-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<development-publishable-key>
SUPABASE_ENV=development
SUPABASE_URL=https://<development-project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<development-publishable-key>
ALLOW_HOSTED_SUPABASE_DEV=true
```

### Production

```text
VITE_VERCEL_ENV=production
VITE_SUPABASE_ENV=production
VITE_SUPABASE_URL=https://<production-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<production-publishable-key>
SUPABASE_ENV=production
SUPABASE_URL=https://<production-project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<production-publishable-key>
```

Production 不需要、也不应设置 `ALLOW_HOSTED_SUPABASE_DEV`。`SUPABASE_SERVICE_ROLE_KEY` 当前不需要，禁止加入前端或 Vercel 环境，除非未来确有服务端管理任务。

## 代码层保护

- Vercel 构建时校验 `VERCEL_ENV`、`VITE_VERCEL_ENV`、`VITE_SUPABASE_ENV` 是否匹配；不匹配会直接失败。
- 浏览器端在开发环境默认只接受本地 Supabase；生产 bundle 在本机预览时默认拒绝连接生产项目。
- Serverless API 只读取 `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`，并校验 `SUPABASE_ENV`；Preview 未显式使用开发项目时 fail closed。
- `profiles` 的身份字段不再允许浏览器直接写入，整柜公开状态通过 `set_wardrobe_public` RPC 修改。
- 公开图片仍经 `/api/img` 做分享 gate；由于当前 Blob 对象仍是 public，已经被复制的旧 Blob URL 无法被应用层撤回。

## 发布前检查

```text
1. 在两个 Supabase 项目分别执行全部 migrations。
2. 确认 Preview / Production 的变量 Scope 没有交叉。
3. 修改 Vercel 变量后重新部署；VITE_* 是构建时注入。
4. 访问 Preview 和 Production，分别确认登录、读写和分享权限。
5. 生产环境不要开启 ALLOW_DEV_PROD_SERVICES 或 ALLOW_HOSTED_SUPABASE_DEV。
6. 邮箱 onboarding 发布前，用受控测试邮箱验证注册、收信、点击 `/auth/confirm`、重复点击、过期链接和回跳路径。
```

## 最近一次线上配置检查

2026-07-17 通过 Vercel CLI 确认原配置把同一组 `VITE_SUPABASE_*` 变量同时覆盖 Preview / Production，实际没有环境隔离。现在已完成以下处理：Production 已补齐 `VITE_VERCEL_ENV=production`、`VITE_SUPABASE_ENV=production`、`SUPABASE_ENV=production`、服务端 Supabase URL / publishable key；Preview 已移除原有 Supabase URL / key，并标记为 `preview` / `development`，因此在没有独立开发 Supabase 项目之前会安全地构建失败。

生产 Supabase 已完成迁移基线修复，并执行全部 4 个 migrations，包含 `202607170001_security_hardening.sql`。开发项目 `wearlog-dev` 已创建（ref：`mazsopbfpqchzhyuaron`），同样执行了全部 4 个 migrations；Preview Vercel 变量已切换到该项目。Production 已部署并绑定 `www.wearlog.cn`。

2026-07-18 复核：两套 Supabase Auth settings 均为 `mailer_autoconfirm=false`；密码登录和找回密码 API 可达，但尚未用真实收件箱证明 SMTP 投递、回跳白名单和浏览器端到端流程。Preview 部署默认受 Vercel Deployment Protection 保护，匿名探测不能等同于 Preview 构建失败。
