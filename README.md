# Balloon Burst Gift

Balloon Burst Gift 是一个集体线上气球送礼系统。组织者创建礼物房间，送礼者通过录音、文字和图片制作气球礼物，收礼者打开链接后在全屏气球现场中点击气球，让祝福以文字、图片、声波和署名碎片的形式展开。

## 代码用途

本项目用于完成一个创意编程课程大作业，核心目标是实现“输入数据 -> 生成创意视觉效果 -> 输出为礼物”的完整流程。

项目中的主要功能包括：

- 创建礼物房间，并生成送礼链接、管理链接和收礼链接。
- 送礼者录音并制作气球，录音和附加数据会影响气球大小、纹理、发光和碎片数量。
- 组织者管理已提交的气球礼物，并发布最终收礼链接。
- 收礼者进入全屏气球场，点击单个气球或长按触发全场爆炸。
- 单个气球爆炸时可以播放对应录音，全场爆炸时只展示转写文字和礼物碎片，避免多个录音同时播放。

## 技术栈

- React
- TypeScript
- Vite
- React Router
- Supabase
- Vitest
- Testing Library
- Canvas / SVG / CSS 动画
- MediaRecorder / Web Audio API

## 主要目录

```text
src/
├── data/               # 房间、礼物、存储和 Supabase 数据访问
├── domain/             # 核心类型与气球参数生成逻辑
├── features/
│   ├── giver/          # 送礼者录音、音频分析、气球制作页面
│   ├── manage/         # 组织者管理页面
│   └── recipient/      # 收礼者气球现场和爆炸交互
├── pages/              # 路由页面
├── styles/             # 全局样式
├── visual/             # 气球绘制、布局、爆炸碎片和仪式逻辑
└── test/               # 测试公共工具

supabase/
└── schema.sql          # Supabase 数据表、存储桶和访问策略
```

## 依赖安装包

运行项依赖：

```text
@supabase/supabase-js
react
react-dom
react-router-dom
```

开发与测试依赖：

```text
@vitejs/plugin-react
typescript
vite
vitest
jsdom
@testing-library/react
@testing-library/jest-dom
@testing-library/user-event
@types/react
@types/react-dom
```

安装全部依赖：

```powershell
npm install
```

不需要逐个手动安装上面的包，`npm install` 会根据 `package.json` 自动安装。

## Config 配置

项目使用 Vite 环境变量。可以复制 `.env.example` 为 `.env.local`：

```powershell
Copy-Item .env.example .env.local
```

`.env.local` 可配置：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_REPOSITORY_MODE=supabase
```

配置说明：

| 配置项 | 用途 |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase 项目地址 |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名访问 key |
| `VITE_REPOSITORY_MODE` | 数据模式，可选 `supabase`、`local`、`memory` |

### 本地演示模式

如果只想在本机体验 UI 和流程，不连接 Supabase，可以使用：

```env
VITE_REPOSITORY_MODE=memory
```

这个模式只适合单机演示，别人设备无法共享你的房间和气球。

### Supabase 模式

如果需要让不同设备共享房间、气球、录音和图片，需要配置 Supabase：

1. 创建 Supabase 项目。
2. 在 Supabase SQL Editor 中执行：

```text
supabase/schema.sql
```

3. 在 `.env.local` 中填写真实的 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。
4. 设置：

```env
VITE_REPOSITORY_MODE=supabase
```

## 代码如何运行

### 方式一：使用启动脚本

在项目根目录双击：

```text
start-dev.cmd
```

或在 PowerShell 中运行：

```powershell
.\scripts\start-dev.ps1
```

启动脚本会自动处理以下事情：

- 创建 `.env.local`。
- 默认使用本地演示模式。
- 检查依赖。
- 查找可用端口。
- 启动 Vite 开发服务器。
- 自动打开浏览器。

### 方式二：手动运行

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

启动后在浏览器打开终端显示的地址，通常是：

```text
http://localhost:5173/
```

或：

```text
http://127.0.0.1:5173/
```

## 常用命令

```powershell
npm run dev
```

启动开发服务器。

```powershell
npm test
```

运行测试。

```powershell
npm run lint
```

运行 TypeScript 类型检查。

```powershell
npm run build
```

生成生产环境构建文件，输出目录为 `dist/`。

```powershell
npm run preview
```

预览生产构建结果。

## 页面路由

| 路由 | 用途 |
| --- | --- |
| `/` | 创建礼物房间 |
| `/gift/:inviteToken` | 送礼者制作气球礼物 |
| `/manage/:manageToken` | 组织者管理房间 |
| `/r/:recipientToken` | 收礼者打开气球现场 |

## 部署说明

本地地址如 `localhost` 或 `127.0.0.1` 只能在自己的电脑上访问。如果要把链接发给别人，需要部署到公网。

推荐部署方式：

- 前端：Vercel 或 Netlify
- 数据库与文件存储：Supabase

部署时需要设置环境变量：

```env
VITE_REPOSITORY_MODE=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

构建命令：

```text
npm run build
```

输出目录：

```text
dist
```

项目中已包含：

- `vercel.json`：用于 Vercel 前端路由回退。
- `netlify.toml`：用于 Netlify 构建和前端路由回退。

## 注意事项

- 不要提交 `node_modules/`。
- 不要提交 `dist/`。
- 不要提交真实的 `.env.local` 密钥。
- 如果只是课堂单机展示，可以使用 `memory` 模式。
- 如果要让多个设备共享同一个礼物房间，必须使用 Supabase 模式并部署到公网。
