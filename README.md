# Balloon Burst Gift

Balloon Burst Gift 是一个集体线上送礼系统：送礼者录音，声音和附加数据会把气球吹大；收礼者打开链接后，点击满屏气球，让祝福以碎片、文字、图片和声音爆开。

## 为什么别人现在打不开链接

本地开发地址一般是 `http://localhost:端口` 或 `http://127.0.0.1:端口`。这个地址只代表“打开者自己的电脑”，所以你复制给别人后，别人电脑上并没有运行这套应用，自然打不开。

要让送礼人和收礼人在自己的电脑或手机上打开链接，需要两件事：

- 一个公网 HTTPS 前端地址，例如 Vercel、Netlify、GitHub Pages。
- 一个所有设备共享的云端数据和文件存储，例如 Supabase。只把代码放到 GitHub 不够，因为 localStorage 只存在于当前浏览器。

推荐部署路径是：GitHub 保存代码，Vercel 或 Netlify 托管网页，Supabase 保存房间、气球、录音和图片。

## 本地运行

最省心的方式是在项目根目录双击：

```text
start-dev.cmd
```

或在 PowerShell 里运行：

```powershell
.\scripts\start-dev.ps1
```

脚本会自动创建 `.env.local`、使用本地内存模式、检查依赖、寻找可用端口、启动 Vite，并打开浏览器。

手动运行方式：

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

`.env.local` 里可配置：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_REPOSITORY_MODE=supabase`

如果只想本地体验 UI 和流程，不连接 Supabase：

```env
VITE_REPOSITORY_MODE=memory
```

这个模式只适合单机演示，别人设备无法共享你的房间和气球。生产部署默认会使用 Supabase。

## Supabase 设置

1. 创建 Supabase 项目。
2. 在 SQL Editor 执行 `supabase/schema.sql`。
3. SQL 会自动创建 `gift-media` Storage bucket，并配置匿名上传、公开读取策略。

## 公网部署

### 方案 A：Vercel

1. 把项目推到 GitHub。需要上传源代码和配置文件，不要上传 `node_modules/`、`dist/`、`.env.local`。
2. 在 Vercel 导入这个 GitHub 仓库。
3. 在 Vercel 项目的 Environment Variables 设置：

```env
VITE_REPOSITORY_MODE=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. Build Command 使用 `npm run build`，Output Directory 使用 `dist`。
5. 部署完成后，用 Vercel 给出的 HTTPS 域名创建房间。系统生成的 `/gift/...`、`/manage/...`、`/r/...` 链接就可以发给别人。

项目里的 `vercel.json` 已经处理了直接打开 `/gift/...`、`/manage/...`、`/r/...` 时的前端路由回退。

### 方案 B：Netlify

1. 把项目推到 GitHub，然后在 Netlify 导入仓库。
2. 设置同样三个环境变量。
3. Build Command 使用 `npm run build`，Publish Directory 使用 `dist`。

项目里的 `netlify.toml` 已经配置了单页应用路由回退。

### 关于 GitHub Pages

GitHub Pages 只能托管静态前端，仍然需要 Supabase 作为共享后端。它也需要额外处理前端路由刷新问题；课程展示建议优先用 Vercel 或 Netlify。

## 验证

```powershell
npm test
npm run build
```
