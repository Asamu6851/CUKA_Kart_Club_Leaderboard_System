# CUKA在线圈速榜

这是面向卡丁车俱乐部正式运行的在线圈速管理系统，采用前后端分离架构，支持会员端与管理员端多人共用。

## 当前版本

- 本仓库现在只保留新版正式系统
- 旧版根目录 `app.js / index.html / styles.css / server.ps1 / start-server.bat` 已移除
- 前端位于 `frontend/`
- 后端位于 `backend/`
- 统一网关配置位于 `infra/nginx/`
- 一体化部署使用 `docker-compose.yml`

## 已实现功能

### 会员端

- 用户注册、登录
- 个人资料编辑
- 公开车手页访问
- 个人头像 / 定妆照上传
- 成绩截图上传
- 成绩提交、查看个人提交记录
- 查看正式榜单
- 查看会员名录并点击昵称进入个人页

### 管理员端

- 管理员登录
- 会员审核
- 会员管理
  - 管理员代创建账号
  - 停用账号
  - 删除账号
  - 重置密码
- 赛道管理
  - 新增赛道
  - 停用赛道
- 成绩审核
  - 审核提交
  - 驳回提交
  - 审核通过后自动入榜
- 正式成绩管理
  - 手动录入
  - 修改
  - 删除

## 车型选项

- `200cc`
- `270cc`
- `超级4T(200)`
- `超级4T(206)`
- `GPMAX`
- `X30`

## 技术栈

- 前端：`Vue 3 + TypeScript + Vite + Pinia + Element Plus`
- 后端：`NestJS + TypeScript + Prisma`
- 数据库：`PostgreSQL`
- 缓存：`Redis`
- 文件存储：`MinIO`
- 网关：`Nginx`
- 部署：`Docker Compose`

## 目录结构

```text
.
├─ backend/              # NestJS 后端
├─ frontend/             # Vue 前端
├─ infra/nginx/          # Nginx 网关配置
├─ docker-compose.yml    # 容器编排
├─ .env.example          # 根目录环境变量模板
└─ ARCHITECTURE_LINUX.md # Linux 正式部署架构说明
```

## 本地启动

1. 复制环境变量文件：

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

2. 按需修改 `.env`：

- `POSTGRES_PASSWORD`
- `MINIO_ROOT_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN`

3. 启动服务：

```bash
docker compose up -d --build
```

4. 访问地址：

- 前端首页：`http://localhost/`
- 如果你本地把 `HTTP_PORT` 改成了 `8088`，则访问：`http://localhost:8088/`
- 后端健康检查：`http://localhost/api/v1/health`

## 默认管理员账号

- 用户名：`CUKA_Admin`
- 密码：`Admin123456`

你也可以在 `.env` 中修改：

- `DEFAULT_ADMIN_USERNAME`
- `DEFAULT_ADMIN_NICKNAME`
- `DEFAULT_ADMIN_PASSWORD`

## 环境变量

根目录 `.env.example` 已包含默认配置：

- `HTTP_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `MINIO_BUCKET`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `DEFAULT_ADMIN_USERNAME`
- `DEFAULT_ADMIN_NICKNAME`
- `DEFAULT_ADMIN_PASSWORD`
- `CORS_ORIGIN`
- `VITE_API_BASE_URL`

## 常用命令

启动：

```bash
docker compose up -d --build
```

查看容器状态：

```bash
docker compose ps
```

查看后端日志：

```bash
docker compose logs backend --tail=200
```

查看网关日志：

```bash
docker compose logs gateway --tail=200
```

停止服务：

```bash
docker compose down
```

## 旧数据迁移

如果你有旧版 `store.json` 数据，可以使用后端脚本迁移到 PostgreSQL。

相关脚本位于：

- `backend/scripts/migrate-store-json.ts`

项目中也已经配置了命令：

```bash
npm run migrate:store-json
```

请在 `backend/` 目录下执行，或通过 Docker 容器执行。

## 部署建议

- 正式环境建议使用 `Linux`
- 推荐 `2核4G` 起步，长期正式使用建议 `4核8G`
- 建议搭配域名、HTTPS、数据库定期备份

详细说明可查看：

- [ARCHITECTURE_LINUX.md](./ARCHITECTURE_LINUX.md)

## 仓库说明

- `.env`、数据库备份、日志、`node_modules/`、构建产物已通过 `.gitignore` 排除
- 当前仓库适合作为正式项目主仓库继续开发和部署
