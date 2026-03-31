# CUKA Linux 正式版架构方案

## 1. 目标

当前项目已经具备可用的业务雏形，但它更适合俱乐部内部试运行，不适合作为长期正式系统直接扩容。升级目标是把它演进为一套可以部署在 Linux 服务器、支持多人同时在线、具备更强数据安全与可维护性的正式 Web 系统。

本方案重点解决以下问题：

- 支持 Linux 服务器长期稳定运行
- 支持多人同时在线访问和操作
- 使用数据库替代单一 JSON 文件存储
- 使用对象存储管理成绩截图等文件
- 支持后续扩展到微信小程序、移动端或更多管理员角色
- 具备更规范的权限、审计、备份和发布流程

## 2. 当前版本的局限

当前仓库使用的是：

- 原生 HTML / CSS / JavaScript 前端
- PowerShell 自建 HTTP 服务
- `data/store.json` 作为核心数据存储
- `data/uploads/` 作为截图目录

这种实现方式在试运行阶段足够轻量，但作为正式项目会有这些问题：

- JSON 文件不适合多人并发读写，容易产生一致性和扩展性问题
- 应用会话存在进程内存中，服务重启后登录状态会丢失
- 自写 HTTP 服务更适合轻量内部工具，不适合作为长期正式线上网关
- 本地文件上传难以应对后续扩容、迁移、备份和 CDN 分发
- 后续如果要增加复杂权限、日志审计、消息通知、多端接入，维护成本会明显上升

## 3. 推荐目标架构

建议将系统升级为单体业务系统，而不是微服务。

对当前项目来说，单体架构更适合：

- 功能集中，业务边界清晰
- 团队成本更低，维护更简单
- 比微服务更容易部署和排障
- 足够支撑俱乐部规模的正式运营

推荐架构如下：

```text
浏览器 / 手机 H5 / 后续小程序
            |
            v
        Nginx / Caddy
      HTTPS / 域名 / 反向代理
            |
            v
      Backend API Service
    认证 / 审批 / 成绩 / 榜单 / 管理
            |
   +--------+---------+-----------+
   |                  |           |
   v                  v           v
PostgreSQL         Redis      MinIO / S3
业务数据            会话/缓存     截图与附件
```

## 4. 推荐技术栈

### 4.1 前端

- `Vue 3`
- `TypeScript`
- `Vite`
- `Pinia`
- `Element Plus`

前端职责：

- 会员登录、注册、提交成绩
- 管理员审核注册和成绩
- 榜单、PB、记录查询
- 文件上传、筛选、统计展示

推荐原因：

- Vue 3 学习和维护成本较低
- TypeScript 有利于长期维护和多人协作
- Element Plus 适合后台管理场景，能较快搭出正式界面
- 后续如果做 H5 或小程序 API 复用，也更顺畅

### 4.2 后端

- `NestJS`
- `TypeScript`
- `Prisma ORM`

后端职责：

- 用户认证与权限控制
- 会员注册审批
- 成绩提交、审核、入榜
- 榜单和统计接口
- 上传截图管理
- 审计日志与后台管理

推荐原因：

- NestJS 非常适合做后台管理和中后台业务
- 模块化清晰，适合审批流、角色权限、日志等业务
- TypeScript 能和前端统一语言，降低理解成本
- Prisma 对数据库迁移和类型安全很友好

### 4.3 数据层

- `PostgreSQL`
- `Redis`
- `MinIO` 或云对象存储 `S3 / OSS / COS`

各自职责：

- PostgreSQL：保存用户、赛道、成绩、审批、日志等核心业务数据
- Redis：保存刷新令牌、缓存排行榜、接口限流、短期会话信息
- MinIO / S3：保存成绩截图、证据附件和未来扩展文件

推荐原因：

- PostgreSQL 足够稳定，查询能力强，适合正式项目
- Redis 可以明显改善登录状态和统计接口性能
- 对象存储比本地目录更适合长期线上使用

### 4.4 运维与部署

- `Ubuntu 22.04 LTS` 或 `Ubuntu 24.04 LTS`
- `Docker`
- `Docker Compose`
- `Nginx` 或 `Caddy`
- `GitHub Actions`

推荐原因：

- Ubuntu 是成熟稳定的 Linux 服务器环境
- Docker Compose 足以支撑当前阶段的一体化部署
- Nginx / Caddy 负责域名、HTTPS 和反向代理
- GitHub Actions 可自动完成构建、测试和部署

## 5. 技术栈一句话总结

推荐正式版技术栈：

`Vue 3 + TypeScript + NestJS + PostgreSQL + Redis + MinIO + Nginx + Docker Compose + Ubuntu`

这套栈的特点是：

- 足够正式
- 维护难度可控
- 适合 Linux 服务器部署
- 后续扩展微信小程序、App 或更多角色时不需要重来

## 6. 系统模块设计

建议后端按模块组织：

- `auth`
- `users`
- `members`
- `tracks`
- `submissions`
- `records`
- `leaderboards`
- `files`
- `audit-logs`
- `stats`

各模块职责如下：

### 6.1 auth

- 登录
- 登出
- 刷新令牌
- 修改密码
- 权限校验

### 6.2 users / members

- 用户基础资料
- 会员资料
- 会员注册申请
- 管理员审核通过 / 驳回
- 账号状态启用 / 停用

### 6.3 tracks

- 赛道管理
- 赛道配置
- 圈速榜单按赛道查询
- 赛道状态控制

### 6.4 submissions

- 会员提交成绩
- 上传截图
- 待审批列表
- 驳回原因
- 重新提交机制

### 6.5 records

- 管理员直接录入成绩
- 审批通过后生成正式成绩
- 删除、编辑、归档
- 车型、最终排名、车号、备注等字段管理

### 6.6 leaderboards / stats

- 赛道排行榜
- 个人 PB
- 车型维度排行榜
- 月度 / 赛季统计

### 6.7 files

- 上传截图
- 访问受控图片
- 文件元数据记录
- 删除与替换

### 6.8 audit-logs

- 管理员审批日志
- 成绩删除日志
- 账号操作日志
- 登录与异常行为日志

## 7. 数据库设计建议

建议的核心表如下：

- `users`
- `roles`
- `user_roles`
- `member_profiles`
- `tracks`
- `kart_types`
- `submissions`
- `submission_attachments`
- `records`
- `leaderboard_snapshots`
- `refresh_tokens`
- `audit_logs`

### 7.1 users

建议字段：

- `id`
- `username`
- `nickname`
- `password_hash`
- `status`
- `last_login_at`
- `created_at`
- `updated_at`

用途：

- 保存系统登录账号
- 区分启用、停用、待审核等状态

### 7.2 member_profiles

建议字段：

- `id`
- `user_id`
- `approval_status`
- `review_note`
- `reviewed_by`
- `reviewed_at`
- `created_at`
- `updated_at`

用途：

- 保存会员注册审批相关数据
- 把账号与会员业务资料解耦

### 7.3 tracks

建议字段：

- `id`
- `name`
- `location`
- `length_meters`
- `layout`
- `status`
- `note`
- `created_at`
- `updated_at`

### 7.4 kart_types

建议字段：

- `id`
- `code`
- `name`
- `sort_order`
- `is_enabled`

初始数据可包括：

- `200cc`
- `270cc`
- `super4t200`
- `super4t206`
- `gpmax`
- `x30`

### 7.5 submissions

建议字段：

- `id`
- `member_id`
- `track_id`
- `kart_type_id`
- `lap_time_ms`
- `lap_time_text`
- `final_ranking`
- `kart_no`
- `weather`
- `note`
- `status`
- `review_note`
- `reviewed_by`
- `reviewed_at`
- `submitted_at`

### 7.6 submission_attachments

建议字段：

- `id`
- `submission_id`
- `bucket`
- `object_key`
- `file_name`
- `mime_type`
- `file_size`
- `created_at`

### 7.7 records

建议字段：

- `id`
- `member_id`
- `track_id`
- `kart_type_id`
- `source_type`
- `source_submission_id`
- `lap_time_ms`
- `lap_time_text`
- `race_date`
- `final_ranking`
- `kart_no`
- `weather`
- `note`
- `approved_by`
- `approved_at`
- `created_at`
- `updated_at`

说明：

- `source_type` 用于区分管理员录入还是会员提交审批生成
- 这样能保留完整来源链路，方便追溯

### 7.8 audit_logs

建议字段：

- `id`
- `operator_user_id`
- `action`
- `target_type`
- `target_id`
- `detail_json`
- `ip`
- `user_agent`
- `created_at`

用途：

- 审批记录可追溯
- 删除操作可审计
- 便于定位异常问题

## 8. 接口设计建议

以下是推荐的核心 API 分组：

### 8.1 认证接口

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/change-password`
- `GET /api/v1/auth/me`

### 8.2 会员与审批接口

- `POST /api/v1/member/register`
- `GET /api/v1/admin/members`
- `GET /api/v1/admin/members/pending`
- `POST /api/v1/admin/members/:id/approve`
- `POST /api/v1/admin/members/:id/reject`
- `PATCH /api/v1/admin/members/:id/status`

### 8.3 赛道接口

- `GET /api/v1/tracks`
- `POST /api/v1/admin/tracks`
- `PATCH /api/v1/admin/tracks/:id`
- `DELETE /api/v1/admin/tracks/:id`

### 8.4 成绩提交接口

- `POST /api/v1/member/submissions`
- `GET /api/v1/member/submissions`
- `DELETE /api/v1/member/submissions/:id`
- `GET /api/v1/admin/submissions/pending`
- `POST /api/v1/admin/submissions/:id/approve`
- `POST /api/v1/admin/submissions/:id/reject`

### 8.5 正式成绩接口

- `GET /api/v1/records`
- `POST /api/v1/admin/records`
- `PATCH /api/v1/admin/records/:id`
- `DELETE /api/v1/admin/records/:id`

### 8.6 榜单与统计接口

- `GET /api/v1/leaderboards`
- `GET /api/v1/personal-bests`
- `GET /api/v1/stats/overview`
- `GET /api/v1/stats/tracks/:trackId`

## 9. 登录与权限方案

推荐使用：

- `JWT Access Token`
- `Refresh Token`
- `RBAC` 角色权限模型

建议角色：

- `super_admin`
- `admin`
- `member`

建议权限规则：

- 会员只能查看自己的提交记录
- 管理员可以审批会员和成绩
- 超级管理员可管理管理员账号、系统配置和全局审计日志

## 10. 文件上传方案

推荐使用对象存储保存截图，而不是项目本地目录。

建议流程：

1. 前端上传截图到后端
2. 后端校验格式、大小、用户权限
3. 后端将文件上传到 MinIO 或 S3
4. 数据库中保存文件元数据
5. 审批页面展示缩略图和原图链接

建议限制：

- 只允许图片格式
- 限制单文件大小
- 文件名不要使用原始用户输入
- 元数据入库，便于后续清理和审计

## 11. Linux 部署方案

推荐使用 Docker Compose 进行部署。

### 11.1 推荐服务组成

- `web`
- `api`
- `postgres`
- `redis`
- `minio`
- `nginx`

### 11.2 部署职责

- `web`：前端静态资源
- `api`：NestJS 后端服务
- `postgres`：业务数据库
- `redis`：缓存和令牌
- `minio`：截图对象存储
- `nginx`：域名、HTTPS、反向代理

### 11.3 部署建议

- 使用 `Ubuntu LTS`
- 使用 `docker compose up -d`
- 使用 `Nginx` 或 `Caddy` 提供 HTTPS
- 使用域名访问，不暴露内部容器端口给公网
- 通过环境变量管理数据库、存储、JWT 等配置

## 12. 备份与运维建议

正式项目必须加入备份和观测能力。

建议至少包含：

- PostgreSQL 定时备份
- MinIO / S3 文件备份
- 关键日志保留
- 容器健康检查
- 异常告警

建议增加的运维能力：

- 接口访问日志
- 登录失败告警
- 管理员关键操作日志
- 定期数据库备份演练

## 13. 迁移路线

建议按 5 个阶段推进：

### 阶段 1：冻结业务规则

- 明确现有字段和审批流程
- 确认保留哪些历史数据
- 固定车型、赛道、审批状态和角色规则

### 阶段 2：设计数据库和导入脚本

- 基于现有 `store.json` 设计 PostgreSQL 表结构
- 编写一次性迁移脚本
- 导入会员、赛道、成绩、提交记录、截图路径

### 阶段 3：搭建正式后端

- 建立 NestJS 项目
- 完成认证、审批、成绩和榜单 API
- 接入 PostgreSQL、Redis 和对象存储

### 阶段 4：重建前端后台

- 用 Vue 3 实现会员端与管理员端
- 保留当前业务流程
- 优化审批体验、查询筛选和榜单展示

### 阶段 5：正式上线

- 配置 Linux 服务器
- 配置 Docker Compose
- 配置 HTTPS
- 导入历史数据
- 进行灰度测试和正式切换

## 14. 项目实施建议

如果你准备把它做成正式项目，我建议优先顺序如下：

1. 先确定数据库结构和业务规则
2. 再搭建后端 API
3. 再做前端重构
4. 最后做部署、备份和监控

不建议一开始就做微服务，也不建议在现有 PowerShell 代码上继续叠加复杂功能。

## 15. 建议的下一步

基于这个方案，最适合继续推进的工作有 3 件：

1. 输出数据库表结构初稿
2. 输出 API 文档初稿
3. 在当前仓库里搭建 Linux 正式版项目骨架

如果你下一步愿意继续，我建议直接进入第 3 步：我可以开始在仓库里搭建 `frontend + backend + docker-compose` 的正式项目骨架。
