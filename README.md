# CUKA在线圈速榜

这是面向卡丁车俱乐部正式运行的在线圈速管理系统，包含会员端与管理员端两套完整功能。

## 已实现功能

- 会员账号注册与登录
- 管理员账号登录
- 会员提交成绩截图，进入待审批队列
- 管理员审批通过后，成绩进入正式榜单
- 管理员直接录入正式成绩
- 赛道管理
- 会员账号管理
- 删除会员、赛道、正式成绩、待审批提交
- 正式成绩榜单、个人 PB、历史记录
- 新增字段：
  - 最终排名
  - 车型
  - 截图凭证

## 车型选项

- `200cc`
- `270cc`
- `超级4T(200)`
- `超级4T(206)`
- `GPMAX`
- `X30`

## 启动方式

推荐直接双击：

- `start-server.bat`

或者在当前目录执行：

```powershell
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\server.ps1 -HostName 0.0.0.0 -Port 80
```

启动后访问：

- 服务器本机：`http://localhost/`
- 其他电脑或手机：`http://服务器IP/`
- 使用域名：`http://你的域名/`

## 默认管理员账号

- 用户名：`CUKA_Admin`
- 密码：`Admin123456`

首次启动后，管理员可以：

1. 创建赛道
2. 创建会员账号，或者让会员自行注册
3. 审批会员上传的成绩截图
4. 直接录入正式成绩

## 数据存储

服务端数据保存在：

- `data/store.json`
- `data/uploads/`
- `data/store.example.json`

其中：

- `store.json` 保存账号、赛道、成绩和审批数据
- `uploads/` 保存会员上传的截图文件
- `store.example.json` 是适合提交到 Git 仓库的示例数据

## Git 仓库建议

- 仓库中建议保留源码、README、`data/store.example.json`
- 不建议提交真实运行数据 `data/store.json`
- 不建议提交会员截图 `data/uploads/`
- 项目已提供 `.gitignore`，会自动忽略这些文件

## 角色说明

### 会员端

- 登录后可提交成绩
- 提交时必须附带截图
- 提交内容包括：赛道、日期、圈速、最终排名、车型、车号、天气、备注
- 提交后需等待管理员审批
- 可查看自己的提交记录和审批状态

### 管理员端

- 查看待审批成绩
- 审批或驳回会员提交
- 创建赛道
- 创建会员账号
- 手动录入正式成绩
- 查看正式成绩总览、个人 PB 和完整成绩记录

## Web 端如何读取数据

这个项目的网页端并不会直接打开 `data/store.json`。

正确的工作方式是：

1. 浏览器访问 `http://服务器IP/` 或 `http://你的域名/`
2. 页面里的 `app.js` 再请求同一台服务器上的 `/api/session`、`/api/dashboard`、`/api/auth/login`
3. `server.ps1` 在服务器本地读取 `data/store.json`
4. 后端把 JSON 结果返回给网页

也就是说：

- `store.json` 仍然只保存在服务器本地
- 但网页端可以通过同一个后端接口间接读取和写入这份数据
- 会员注册、登录、成绩提交、管理员审批，都会写回服务器上的 `data/store.json`

如果你是直接双击打开本地 `index.html`，或者把前端放到别的地方单独访问，就不会连到这份真实数据。必须通过 PowerShell 服务提供的地址打开网页。

## 局域网 / 外网使用说明

当前默认启动方式已经改成监听所有网卡：

- `0.0.0.0:80`

因此只要服务已启动，你就可以使用：

- 本机访问：`http://localhost/`
- 局域网访问：`http://服务器内网IP/`
- 公网访问：`http://服务器公网IP/`
- 域名访问：`http://你的域名/`

要让其他设备正常访问，还需要同时满足：

- Windows 防火墙放行 `80`
- 云服务器安全组 / 入站规则放行 `80`
- 启动网页时使用 `http://服务器IP/` 或 `http://你的域名/`，不要直接打开磁盘里的 `index.html`

## 当前版本定位

当前仓库已经具备正式运行所需的核心业务链路，可用于俱乐部多人在线使用。

如果你准备升级为 Linux 正式版多用户系统，可以继续查看：

- [Linux 正式版架构方案](./ARCHITECTURE_LINUX.md)

## Linux 正式版骨架

仓库现在已经新增了一套 Linux 正式版项目骨架，用于逐步替换当前的 PowerShell + JSON 版本。

目录结构：

- `frontend/`：Vue 3 + TypeScript + Vite + Pinia + Element Plus
- `backend/`：NestJS + TypeScript + Prisma
- `infra/nginx/`：统一网关配置
- `docker-compose.yml`：Linux 一体化容器编排
- `.env.example`：部署环境变量示例

### 新旧两套版本的关系

- 根目录的 `index.html`、`app.js`、`styles.css`、`server.ps1` 仍然是当前可运行旧版
- `frontend/` 和 `backend/` 是正式版新骨架
- 现阶段适合并行推进，不建议立刻删除旧版

### 新版技术栈

- 前端：`Vue 3 + TypeScript + Vite + Pinia + Element Plus`
- 后端：`NestJS + TypeScript + Prisma`
- 数据层：`PostgreSQL + Redis + MinIO`
- 部署层：`Nginx + Docker Compose + Ubuntu`

### 新版本地 / Linux 启动方式

1. 复制环境变量文件：

```bash
cp .env.example .env
```

2. 按需修改 `.env` 中的数据库密码、JWT 密钥和域名相关配置。

3. 启动容器：

```bash
docker compose up -d --build
```

4. 启动后访问：

- 前端首页：`http://服务器IP/`
- 后端健康检查：`http://服务器IP/api/v1/health`

### 当前骨架已包含的内容

- 前端路由、状态管理和 API 请求封装
- 后端模块化目录结构
- Prisma 数据模型初稿
- Docker Compose 容器编排
- Nginx 网关配置
- PostgreSQL + JWT 真实登录模块基础实现
- 默认管理员自动初始化能力

### 当前骨架还没有完成的内容

- PostgreSQL 首版迁移文件
- 会员、赛道、成绩、审批的完整 CRUD
- MinIO 文件上传与访问控制
- 旧版 `store.json` 到 PostgreSQL 的迁移脚本

### 当前默认管理员

新版后端启动时会自动执行 `prisma db push`，并根据环境变量初始化默认管理员账号。

默认值如下：

- 用户名：`CUKA_Admin`
- 昵称：`CUKA Admin`
- 密码：`Admin123456`

你可以在根目录 `.env` 里修改这些变量：

- `DEFAULT_ADMIN_USERNAME`
- `DEFAULT_ADMIN_NICKNAME`
- `DEFAULT_ADMIN_PASSWORD`

下一步如果你继续要升级，我建议按这个顺序走：

1. 增加密码修改和账号停用
2. 增加赛道、会员、成绩的编辑与删除
3. 增加局域网正式部署配置
4. 替换为数据库版本
5. 做成云端正式后台或微信小程序
