# Balloon Burst Gift

Balloon Burst Gift 是一个集体线上送礼系统：送礼者录音，声音和附加数据会把气球吹大；收礼者打开链接后，点击满屏气球，让祝福以碎片、文字、图片和声音爆开。

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

## Supabase 设置

1. 创建 Supabase 项目。
2. 在 SQL Editor 执行 `supabase/schema.sql`。
3. 创建公开读取的 Storage bucket：`gift-media`。
4. 配置 `gift-media` 的匿名上传和公开读取策略。

## 验证

```powershell
npm test
npm run build
```
