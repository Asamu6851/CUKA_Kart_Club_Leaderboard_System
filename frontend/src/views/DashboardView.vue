<template>
  <div class="page-stack">
    <section class="panel-card hero-card dashboard-hero">
      <div class="hero-copy">
        <p class="eyebrow">CUKA在线圈速榜</p>
        <h2>赛道、会员、正式榜单统一管理</h2>
        <p>
          这里是 CUKA 在线圈速榜的系统总览。管理员可以维护赛道、审核会员、代创建账号并管理正式成绩；
          会员可以在统一系统中查看赛道信息、筛选车型榜单和访问车手详情页。
        </p>

        <div class="hero-pills">
          <span class="hero-pill">多人在线共用</span>
          <span class="hero-pill">按赛道 + 车型查榜</span>
          <span class="hero-pill">备注随成绩同步展示</span>
        </div>
      </div>

      <div class="auth-hero-side">
        <article class="spotlight-card">
          <p class="spotlight-kicker">管理范围</p>
          <h3>赛道、会员、成绩一站管理</h3>
          <p class="support-text">
            管理员可以在这里统一维护赛道、审核注册会员、处理正式成绩，并保持榜单口径一致。
          </p>
        </article>

        <article class="spotlight-card spotlight-card-accent">
          <p class="spotlight-kicker">榜单方式</p>
          <h3>先选赛道，再选车型</h3>
          <p class="support-text">
            榜单按赛道和车型分开展示，页面更简洁，也更适合日常快速查榜和分享。
          </p>
        </article>
      </div>
    </section>

    <section class="metric-row">
      <article class="metric-card">
        <span>赛道数量</span>
        <strong>{{ tracks.length }}</strong>
        <p class="metric-copy">当前可用于成绩提交和榜单筛选的赛道基础数据。</p>
      </article>
      <article class="metric-card">
        <span>车型数量</span>
        <strong>{{ kartTypes.length }}</strong>
        <p class="metric-copy">榜单和正式成绩会按不同车型独立管理。</p>
      </article>
      <article class="metric-card">
        <span>当前榜单人数</span>
        <strong>{{ leaderboardItemCount }}</strong>
        <p class="metric-copy">指当前筛选条件下显示的正式入榜人数。</p>
      </article>
      <article class="metric-card">
        <span>已注册会员</span>
        <strong>{{ memberMetric }}</strong>
        <p class="metric-copy">当前可查看车手详情页的会员数量。</p>
      </article>
    </section>

    <section v-if="isAdmin" class="section-grid admin-track-grid">
      <section class="panel-card form-card">
        <div class="section-heading">
          <div>
            <h2>新增赛道</h2>
            <p class="support-text">
              创建完成后，赛道会立即出现在成绩提交通道和榜单筛选中。
            </p>
          </div>
        </div>

        <el-form label-position="top" @submit.prevent="createTrack">
          <div class="record-form-grid">
            <el-form-item label="赛道名称">
              <el-input v-model="trackForm.name" placeholder="例如：CUKA 室内短赛道" />
            </el-form-item>

            <el-form-item label="地点">
              <el-input v-model="trackForm.location" placeholder="例如：上海 / 杭州" />
            </el-form-item>
          </div>

          <div class="record-form-grid">
            <el-form-item label="赛道长度（米）">
              <el-input-number
                v-model="trackForm.lengthMeters"
                :min="1"
                :step="1"
                controls-position="right"
              />
            </el-form-item>

            <el-form-item label="布局">
              <el-input v-model="trackForm.layout" placeholder="例如：正跑 / 反跑 / 夜场布局" />
            </el-form-item>
          </div>

          <el-form-item label="备注">
            <el-input
              v-model="trackForm.note"
              :rows="3"
              placeholder="例如：地面偏滑、最近重铺、适合 X30"
              type="textarea"
            />
          </el-form-item>

          <div class="form-actions">
            <el-button :loading="trackSubmitting" type="primary" @click="createTrack">
              创建赛道
            </el-button>
          </div>
        </el-form>
      </section>

      <section class="panel-card form-card">
        <div class="section-heading">
          <div>
            <h2>赛道管理</h2>
            <p class="support-text">
              停用后不会影响历史成绩，但后续提交和筛选中不再显示该赛道。
            </p>
          </div>
          <el-button :loading="loading" @click="loadDashboard">刷新</el-button>
        </div>

        <div class="table-shell">
          <el-table :data="tracks" empty-text="暂无赛道数据" stripe>
            <el-table-column label="赛道名称" prop="name" min-width="170" />
            <el-table-column label="地点" prop="location" min-width="130" />
            <el-table-column label="长度" width="110">
              <template #default="{ row }">
                {{ formatTrackLength(row.lengthMeters) }}
              </template>
            </el-table-column>
            <el-table-column label="布局" prop="layout" min-width="140" />
            <el-table-column label="备注" prop="note" min-width="180" />
            <el-table-column label="操作" width="120" align="right">
              <template #default="{ row }">
                <el-button
                  :loading="deletingTrackId === row.id"
                  link
                  type="danger"
                  @click="deleteTrack(row)"
                >
                  停用
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </section>
    </section>

    <section v-else class="panel-card form-card">
      <div class="section-heading">
        <div>
          <h2>赛道列表</h2>
          <p class="support-text">
            当前仅展示启用中的赛道，会员提交成绩和榜单筛选使用的也是这份列表。
          </p>
        </div>
        <el-button :loading="loading" @click="loadDashboard">刷新</el-button>
      </div>

      <div class="table-shell">
        <el-table :data="tracks" empty-text="暂无赛道数据" stripe>
          <el-table-column label="赛道名称" prop="name" min-width="180" />
          <el-table-column label="地点" prop="location" min-width="140" />
          <el-table-column label="长度" width="110">
            <template #default="{ row }">
              {{ formatTrackLength(row.lengthMeters) }}
            </template>
          </el-table-column>
          <el-table-column label="布局" prop="layout" min-width="140" />
          <el-table-column label="备注" prop="note" min-width="180" />
        </el-table>
      </div>
    </section>

    <section class="panel-card form-card">
      <div class="section-heading">
        <div>
          <h2>会员名录</h2>
          <p class="support-text">
            管理员和会员都可以在这里查看已注册会员，并点击昵称进入对应车手页。
          </p>
        </div>
        <el-button :loading="loading" @click="loadMembers">刷新名录</el-button>
      </div>

      <div class="record-filter-grid">
        <section class="info-box">
          <h3>成员总数</h3>
          <p class="module-copy">{{ members.length }} 人</p>
        </section>

        <section class="info-box">
          <h3>搜索成员</h3>
          <el-input
            v-model="memberDirectoryKeyword"
            clearable
            placeholder="搜索昵称或用户名"
          />
        </section>
      </div>

      <p class="muted">
        当前显示 {{ filteredDirectoryMembers.length }} / {{ members.length }} 位会员
      </p>

      <div class="table-shell">
        <el-table :data="paginatedDirectoryMembers" empty-text="暂无会员数据" stripe>
          <el-table-column label="昵称" min-width="160">
            <template #default="{ row }">
              <el-button
                class="member-link-button"
                link
                type="primary"
                @click="openDriverProfile(row.id)"
              >
                {{ row.nickname }}
              </el-button>
            </template>
          </el-table-column>
          <el-table-column label="用户名" prop="username" min-width="160" />
          <el-table-column label="加入时间" min-width="180">
            <template #default="{ row }">
              {{ formatDateTime(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="最近登录" min-width="180">
            <template #default="{ row }">
              {{ formatDateTime(row.lastLoginAt) }}
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-pagination
        v-if="filteredDirectoryMembers.length > memberDirectoryPageSize"
        v-model:current-page="memberDirectoryPage"
        v-model:page-size="memberDirectoryPageSize"
        :page-sizes="[10, 20, 50]"
        :total="filteredDirectoryMembers.length"
        background
        class="table-pagination"
        layout="total, sizes, prev, pager, next"
      />
    </section>

    <section v-if="isAdmin" class="section-grid admin-track-grid">
      <section class="panel-card form-card">
        <div class="section-heading">
          <div>
            <h2>管理员代创建账号</h2>
            <p class="support-text">
              适合线下统一录入会员，创建完成后账号默认可直接登录使用。
            </p>
          </div>
        </div>

        <el-form label-position="top" @submit.prevent="createMemberByAdmin">
          <el-form-item label="用户名">
            <el-input
              v-model="memberCreateForm.username"
              placeholder="例如：driver_001"
            />
          </el-form-item>

          <el-form-item label="群昵称">
            <el-input
              v-model="memberCreateForm.nickname"
              placeholder="例如：阿秦 / Geni / CUKA-12"
            />
          </el-form-item>

          <el-form-item label="初始密码">
            <el-input
              v-model="memberCreateForm.password"
              placeholder="至少 6 位"
              show-password
            />
          </el-form-item>

          <div class="form-actions">
            <el-button
              :loading="memberSubmitting"
              type="primary"
              @click="createMemberByAdmin"
            >
              创建会员账号
            </el-button>
            <el-button @click="resetMemberCreateForm">清空</el-button>
          </div>
        </el-form>
      </section>

      <section class="panel-card form-card">
        <div class="section-heading">
          <div>
            <h2>会员管理后台</h2>
            <p class="support-text">
              支持停用、删除和重置密码。删除会员时会一并删除其成绩与提交记录。
            </p>
          </div>
          <el-button :loading="memberLoading" @click="loadManageMembers">刷新列表</el-button>
        </div>

        <div class="record-filter-grid">
          <section class="info-box">
            <h3>账号状态筛选</h3>
            <el-select v-model="memberManageFilters.status" placeholder="全部状态">
              <el-option label="全部状态" value="ALL" />
              <el-option label="正常启用" value="ACTIVE" />
              <el-option label="已停用" value="DISABLED" />
              <el-option label="待审核" value="PENDING" />
              <el-option label="已驳回" value="REJECTED" />
            </el-select>
          </section>

          <section class="info-box">
            <h3>关键词搜索</h3>
            <el-input
              v-model="memberManageKeyword"
              clearable
              placeholder="搜索昵称、用户名、审核备注"
            />
          </section>
        </div>

        <p class="muted">
          当前显示 {{ filteredManagedMembers.length }} / {{ managedMembers.length }} 个会员
        </p>

        <div class="table-shell">
          <el-table :data="paginatedManagedMembers" empty-text="暂无会员数据" stripe>
            <el-table-column label="群昵称" min-width="150">
              <template #default="{ row }">
                <el-button
                  v-if="row.status === 'ACTIVE' && row.approvalStatus === 'APPROVED'"
                  class="member-link-button"
                  link
                  type="primary"
                  @click="openDriverProfile(row.id)"
                >
                  {{ row.nickname }}
                </el-button>
                <span v-else>{{ row.nickname }}</span>
              </template>
            </el-table-column>
            <el-table-column label="用户名" prop="username" min-width="150" />
            <el-table-column label="账号状态" min-width="120">
              <template #default="{ row }">
                <el-tag :type="resolveStatusTagType(row.status)">
                  {{ formatUserStatus(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="审核状态" min-width="120">
              <template #default="{ row }">
                <el-tag :type="resolveApprovalTagType(row.approvalStatus)">
                  {{ formatApprovalStatus(row.approvalStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="最近登录" min-width="180">
              <template #default="{ row }">
                {{ formatDateTime(row.lastLoginAt) }}
              </template>
            </el-table-column>
            <el-table-column label="创建时间" min-width="180">
              <template #default="{ row }">
                {{ formatDateTime(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" min-width="260" align="right">
              <template #default="{ row }">
                <div class="table-actions table-actions-wrap">
                  <el-button
                    v-if="row.status === 'ACTIVE' || row.status === 'DISABLED'"
                    :loading="memberStatusActionId === row.id"
                    link
                    :type="row.status === 'ACTIVE' ? 'warning' : 'success'"
                    @click="toggleMemberStatus(row)"
                  >
                    {{ row.status === "ACTIVE" ? "停用" : "启用" }}
                  </el-button>
                  <el-button
                    :loading="memberPasswordActionId === row.id"
                    link
                    type="primary"
                    @click="resetMemberPassword(row)"
                  >
                    重置密码
                  </el-button>
                  <el-button
                    :loading="memberDeleteActionId === row.id"
                    link
                    type="danger"
                    @click="deleteManagedMember(row)"
                  >
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <el-pagination
          v-if="filteredManagedMembers.length > managedMemberPageSize"
          v-model:current-page="managedMemberPage"
          v-model:page-size="managedMemberPageSize"
          :page-sizes="[10, 20, 50]"
          :total="filteredManagedMembers.length"
          background
          class="table-pagination"
          layout="total, sizes, prev, pager, next"
        />
      </section>
    </section>

    <section v-if="isAdmin" class="panel-card form-card">
      <div class="section-heading">
        <div>
          <h2>待审核会员</h2>
          <p class="support-text">
            新注册的会员会先出现在这里，管理员填写审核备注后再通过或驳回。
          </p>
        </div>
        <el-button :loading="pendingMemberLoading" @click="loadPendingMembers">
          刷新待审核
        </el-button>
      </div>

      <div class="record-filter-grid">
        <section class="info-box">
          <h3>待审核搜索</h3>
          <el-input
            v-model="pendingMemberKeyword"
            clearable
            placeholder="搜索昵称、用户名、备注"
          />
        </section>
      </div>

      <p class="muted">
        当前待审核 {{ filteredPendingMembers.length }} 人
      </p>

      <div v-if="filteredPendingMembers.length === 0" class="empty-hint">
        当前没有待审核会员。
      </div>

      <div v-else class="card-list">
        <article
          v-for="member in paginatedPendingMembers"
          :key="member.id"
          class="submission-card"
        >
          <div class="section-heading">
            <div>
              <h3>{{ member.nickname }} / {{ member.username }}</h3>
              <p class="support-text">
                注册时间 {{ formatDateTime(member.createdAt) }}
              </p>
            </div>
            <el-tag type="warning">
              {{ formatApprovalStatus(member.approvalStatus) }}
            </el-tag>
          </div>

          <div class="meta-grid">
            <div class="info-box">
              <h3>账号状态</h3>
              <p class="module-copy">{{ formatUserStatus(member.status) }}</p>
            </div>
            <div class="info-box">
              <h3>审核状态</h3>
              <p class="module-copy">{{ formatApprovalStatus(member.approvalStatus) }}</p>
            </div>
            <div class="info-box">
              <h3>上次备注</h3>
              <p class="module-copy">{{ member.reviewNote || '-' }}</p>
            </div>
          </div>

          <el-form label-position="top">
            <el-form-item label="审核备注">
              <el-input
                v-model="memberReviewNotes[member.id]"
                :rows="2"
                placeholder="例如：群昵称已确认 / 信息不完整，请补充"
                type="textarea"
              />
            </el-form-item>

            <div class="inline-actions">
              <el-button
                :loading="memberReviewActionId === member.id"
                type="success"
                @click="approvePendingMember(member)"
              >
                审核通过
              </el-button>
              <el-button
                :loading="memberReviewActionId === member.id"
                type="danger"
                @click="rejectPendingMember(member)"
              >
                驳回注册
              </el-button>
            </div>
          </el-form>
        </article>
      </div>

      <el-pagination
        v-if="filteredPendingMembers.length > pendingMemberPageSize"
        v-model:current-page="pendingMemberPage"
        v-model:page-size="pendingMemberPageSize"
        :page-sizes="[6, 12, 24]"
        :total="filteredPendingMembers.length"
        background
        class="table-pagination"
        layout="total, sizes, prev, pager, next"
      />
    </section>

    <section v-if="isAdmin" class="section-grid admin-track-grid">
      <section class="panel-card form-card">
        <div class="section-heading">
          <div>
            <h2>{{ recordModeLabel }}</h2>
            <p class="support-text">
              这里用于管理员手工维护正式成绩。由“会员提交并审核通过”生成的成绩也会显示在右侧列表中，
              但保持只读，避免和审核流程冲突。
            </p>
          </div>
        </div>

        <el-form label-position="top" @submit.prevent="saveRecord">
          <el-form-item label="会员">
            <el-select
              v-model="recordForm.memberId"
              clearable
              filterable
              placeholder="请选择会员"
            >
              <el-option
                v-for="member in members"
                :key="member.id"
                :label="`${member.nickname} / ${member.username}`"
                :value="member.id"
              />
            </el-select>
          </el-form-item>

          <div class="record-form-grid">
            <el-form-item label="赛道">
              <el-select
                v-model="recordForm.trackId"
                clearable
                filterable
                placeholder="请选择赛道"
              >
                <el-option
                  v-for="track in tracks"
                  :key="track.id"
                  :label="track.nameWithLocation"
                  :value="track.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="车型">
              <el-select
                v-model="recordForm.kartTypeId"
                clearable
                placeholder="请选择车型"
              >
                <el-option
                  v-for="kartType in kartTypes"
                  :key="kartType.id"
                  :label="kartType.name"
                  :value="kartType.id"
                />
              </el-select>
            </el-form-item>
          </div>

          <div class="record-form-grid">
            <el-form-item label="圈速">
              <el-input
                v-model="recordForm.lapTimeText"
                placeholder="例如：49.632 或 1:08.532"
              />
            </el-form-item>

            <el-form-item label="比赛日期">
              <el-date-picker
                v-model="recordForm.raceDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择日期"
              />
            </el-form-item>
          </div>

          <div class="record-form-grid">
            <el-form-item label="最终排名">
              <el-input-number
                v-model="recordForm.finalRanking"
                :min="1"
                :step="1"
                controls-position="right"
              />
            </el-form-item>

            <el-form-item label="车号">
              <el-input v-model="recordForm.kartNo" placeholder="例如：12" />
            </el-form-item>
          </div>

          <div class="record-form-grid">
            <el-form-item label="天气">
              <el-input
                v-model="recordForm.weather"
                placeholder="例如：晴 / 阴 / 小雨"
              />
            </el-form-item>

            <el-form-item label="备注">
              <el-input
                v-model="recordForm.note"
                placeholder="例如：雨天、低温、抓地一般"
              />
            </el-form-item>
          </div>

          <div class="form-actions">
            <el-button :loading="recordSubmitting" type="primary" @click="saveRecord">
              {{ editingRecordId ? "保存修改" : "新增正式成绩" }}
            </el-button>
            <el-button v-if="editingRecordId" @click="resetRecordForm">取消编辑</el-button>
          </div>
        </el-form>
      </section>

      <section class="panel-card form-card">
        <div class="section-heading">
          <div>
            <h2>正式成绩列表</h2>
            <p class="support-text">
              支持按赛道、车型和来源筛选。管理员手工录入的成绩可编辑、可删除；审核入榜成绩保持只读。
            </p>
          </div>
          <el-button :loading="recordLoading" @click="loadRecords">刷新列表</el-button>
        </div>

        <div class="record-filter-grid">
          <section class="info-box">
            <h3>筛选赛道</h3>
            <el-select v-model="recordFilters.trackId" clearable filterable placeholder="全部赛道">
              <el-option
                v-for="track in tracks"
                :key="track.id"
                :label="track.nameWithLocation"
                :value="track.id"
              />
            </el-select>
          </section>

          <section class="info-box">
            <h3>筛选车型</h3>
            <el-select v-model="recordFilters.kartTypeId" clearable placeholder="全部车型">
              <el-option
                v-for="kartType in kartTypes"
                :key="kartType.id"
                :label="kartType.name"
                :value="kartType.id"
              />
            </el-select>
          </section>

          <section class="info-box">
            <h3>来源</h3>
            <el-select v-model="recordFilters.sourceType" placeholder="全部来源">
              <el-option label="全部来源" value="ALL" />
              <el-option label="管理员录入" value="ADMIN" />
              <el-option label="审核入榜" value="SUBMISSION" />
            </el-select>
          </section>

          <section class="info-box">
            <h3>关键词搜索</h3>
            <el-input
              v-model="recordKeyword"
              clearable
              placeholder="搜索会员、赛道、车型、备注、圈速"
            />
          </section>
        </div>

        <p class="muted">
          当前显示 {{ filteredRecords.length }} / {{ records.length }} 条正式成绩
        </p>

        <div class="table-shell">
          <el-table :data="paginatedRecords" empty-text="暂无正式成绩" stripe>
            <el-table-column label="会员" min-width="150">
              <template #default="{ row }">
                <el-button
                  class="member-link-button"
                  link
                  type="primary"
                  @click="openDriverProfile(row.member.id)"
                >
                  {{ row.member.nickname }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column label="赛道" min-width="180">
              <template #default="{ row }">
                {{ row.track.location ? `${row.track.name} / ${row.track.location}` : row.track.name }}
              </template>
            </el-table-column>
            <el-table-column label="车型" min-width="120">
              <template #default="{ row }">
                {{ row.kartType.name }}
              </template>
            </el-table-column>
            <el-table-column label="圈速" prop="lapTimeText" width="110" />
            <el-table-column label="日期" min-width="120">
              <template #default="{ row }">
                {{ formatDate(row.raceDate) }}
              </template>
            </el-table-column>
            <el-table-column label="来源" min-width="120">
              <template #default="{ row }">
                <el-tag :type="row.sourceType === 'ADMIN' ? 'primary' : 'success'">
                  {{ formatSourceType(row.sourceType) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="备注摘要" min-width="240">
              <template #default="{ row }">
                {{ buildRecordSummary(row) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="170" align="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button
                    :disabled="row.sourceType !== 'ADMIN'"
                    link
                    type="primary"
                    @click="startEditRecord(row)"
                  >
                    编辑
                  </el-button>
                  <el-button
                    :disabled="row.sourceType !== 'ADMIN'"
                    :loading="deletingRecordId === row.id"
                    link
                    type="danger"
                    @click="deleteRecord(row)"
                  >
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <el-pagination
          v-if="filteredRecords.length > recordPageSize"
          v-model:current-page="recordPage"
          v-model:page-size="recordPageSize"
          :page-sizes="[10, 20, 50]"
          :total="filteredRecords.length"
          background
          class="table-pagination"
          layout="total, sizes, prev, pager, next"
        />
      </section>
    </section>

    <section class="panel-card form-card">
      <div class="section-heading">
        <div>
          <h2>分车型榜单</h2>
          <p class="support-text">
            先选择赛道，再选择车型，只展示当前这一组正式成绩。页面更简洁，也更适合日常查榜。
          </p>
        </div>
        <div class="inline-actions">
          <el-button :loading="loading" @click="loadDashboard">刷新赛道与车型</el-button>
          <el-button :loading="leaderboardLoading" type="primary" @click="loadLeaderboard">
            查看榜单
          </el-button>
        </div>
      </div>

      <div class="record-filter-grid">
        <section class="info-box">
          <h3>选择赛道</h3>
          <el-select
            v-model="leaderboardFilters.trackId"
            clearable
            filterable
            placeholder="请选择赛道"
          >
            <el-option
              v-for="track in tracks"
              :key="track.id"
              :label="track.nameWithLocation"
              :value="track.id"
            />
          </el-select>
        </section>

        <section class="info-box">
          <h3>选择车型</h3>
          <el-select
            v-model="leaderboardFilters.kartTypeId"
            clearable
            placeholder="请选择车型"
          >
            <el-option
              v-for="kartType in kartTypes"
              :key="kartType.id"
              :label="kartType.name"
              :value="kartType.id"
            />
          </el-select>
        </section>
      </div>

      <div class="inline-actions">
        <el-button :loading="leaderboardLoading" type="primary" @click="loadLeaderboard">
          按当前条件查询
        </el-button>
        <el-button @click="resetLeaderboardFilters">重置筛选</el-button>
      </div>

      <div v-if="!hasLeaderboardFilters" class="empty-hint">
        请先选择赛道和车型后再查看榜单。
      </div>

      <div v-else-if="leaderboardLoading" class="empty-hint">
        正在加载榜单数据...
      </div>

      <div v-else-if="!leaderboardGroup" class="empty-hint">
        当前赛道和车型下还没有正式入榜成绩。
      </div>

      <section v-else class="leaderboard-group">
        <div class="section-heading">
          <div>
            <h3>{{ leaderboardGroup.track.name }}</h3>
            <p class="support-text">
              {{ leaderboardGroup.kartType.name }}
              <span v-if="leaderboardGroup.track.location">
                / {{ leaderboardGroup.track.location }}
              </span>
            </p>
          </div>
          <el-tag type="success">{{ leaderboardGroup.items.length }} 人上榜</el-tag>
        </div>

        <div class="table-shell">
          <el-table :data="leaderboardGroup.items" stripe>
            <el-table-column label="排名" prop="rank" width="80" />
            <el-table-column label="会员" min-width="150">
              <template #default="{ row }">
                <el-button
                  class="member-link-button"
                  link
                  type="primary"
                  @click="openDriverProfile(row.member.id)"
                >
                  {{ row.member.nickname }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column label="圈速" prop="lapTimeText" width="120" />
            <el-table-column label="最终排名" width="120">
              <template #default="{ row }">
                {{ row.finalRanking ? `第 ${row.finalRanking} 名` : '-' }}
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="220">
              <template #default="{ row }">
                {{ row.note || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="日期" min-width="140">
              <template #default="{ row }">
                {{ formatDate(row.raceDate) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";

import { apiFetch } from "@/lib/http";
import { useAuthStore } from "@/stores/auth";

interface MemberItem {
  id: string;
  username: string;
  nickname: string;
  status: string;
  approvalStatus: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

interface TrackItem {
  id: string;
  name: string;
  location: string | null;
  lengthMeters: number | null;
  layout: string | null;
  note: string | null;
  nameWithLocation: string;
}

interface KartTypeItem {
  id: string;
  code: string;
  name: string;
  sortOrder?: number;
}

interface LeaderboardRecord {
  rank: number;
  lapTimeText: string;
  raceDate: string;
  finalRanking: number | null;
  note: string | null;
  member: {
    id: string;
    username: string;
    nickname: string;
  };
}

interface LeaderboardGroup {
  track: {
    id: string;
    name: string;
    location: string | null;
  };
  kartType: {
    id: string;
    code: string;
    name: string;
    sortOrder?: number;
  };
  items: LeaderboardRecord[];
}

interface RecordItem {
  id: string;
  sourceType: "ADMIN" | "SUBMISSION";
  sourceSubmissionId: string | null;
  lapTimeMs: number;
  lapTimeText: string;
  raceDate: string;
  finalRanking: number | null;
  kartNo: string | null;
  weather: string | null;
  note: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  member: {
    id: string;
    username: string;
    nickname: string;
  };
  track: {
    id: string;
    name: string;
    location: string | null;
  };
  kartType: {
    id: string;
    code: string;
    name: string;
    sortOrder: number;
  };
  approvedBy: {
    id: string;
    username: string;
    nickname: string;
  } | null;
}

const authStore = useAuthStore();
const router = useRouter();
const loading = ref(false);
const leaderboardLoading = ref(false);
const trackSubmitting = ref(false);
const memberLoading = ref(false);
const pendingMemberLoading = ref(false);
const memberSubmitting = ref(false);
const memberStatusActionId = ref("");
const memberPasswordActionId = ref("");
const memberDeleteActionId = ref("");
const memberReviewActionId = ref("");
const recordLoading = ref(false);
const recordSubmitting = ref(false);
const deletingTrackId = ref("");
const deletingRecordId = ref("");
const editingRecordId = ref("");
const members = ref<MemberItem[]>([]);
const managedMembers = ref<MemberItem[]>([]);
const pendingMembers = ref<MemberItem[]>([]);
const tracks = ref<TrackItem[]>([]);
const kartTypes = ref<KartTypeItem[]>([]);
const records = ref<RecordItem[]>([]);
const leaderboardGroup = ref<LeaderboardGroup | null>(null);
const memberReviewNotes = reactive<Record<string, string>>({});
const memberDirectoryKeyword = ref("");
const memberManageKeyword = ref("");
const pendingMemberKeyword = ref("");
const recordKeyword = ref("");
const memberDirectoryPage = ref(1);
const memberDirectoryPageSize = ref(10);
const managedMemberPage = ref(1);
const managedMemberPageSize = ref(10);
const pendingMemberPage = ref(1);
const pendingMemberPageSize = ref(6);
const recordPage = ref(1);
const recordPageSize = ref(10);

const trackForm = reactive({
  name: "",
  location: "",
  lengthMeters: undefined as number | undefined,
  layout: "",
  note: ""
});

const memberCreateForm = reactive({
  username: "",
  nickname: "",
  password: ""
});

const recordForm = reactive({
  memberId: "",
  trackId: "",
  kartTypeId: "",
  lapTimeText: "",
  raceDate: new Date().toISOString().slice(0, 10),
  finalRanking: undefined as number | undefined,
  kartNo: "",
  weather: "",
  note: ""
});

const leaderboardFilters = reactive({
  trackId: "",
  kartTypeId: ""
});

const memberManageFilters = reactive({
  status: "ALL" as "ALL" | "ACTIVE" | "DISABLED" | "PENDING" | "REJECTED"
});

const recordFilters = reactive({
  trackId: "",
  kartTypeId: "",
  sourceType: "ALL" as "ALL" | "ADMIN" | "SUBMISSION"
});

authStore.initialize();

const isAdmin = computed(
  () => authStore.role === "admin" || authStore.role === "super_admin"
);

const memberMetric = computed(() => {
  return String(members.value.length);
});

const leaderboardItemCount = computed(() => {
  return leaderboardGroup.value?.items.length ?? 0;
});

const hasLeaderboardFilters = computed(() => {
  return Boolean(leaderboardFilters.trackId && leaderboardFilters.kartTypeId);
});

const recordModeLabel = computed(() => {
  return editingRecordId.value ? "编辑正式成绩" : "新增正式成绩";
});

const filteredDirectoryMembers = computed(() => {
  const keyword = memberDirectoryKeyword.value.trim().toLowerCase();

  return [...members.value]
    .filter((member) => {
      if (!keyword) {
        return true;
      }

      return matchesKeyword(keyword, member.nickname, member.username);
    })
    .sort((left, right) => {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
});

const paginatedDirectoryMembers = computed(() => {
  return paginateItems(
    filteredDirectoryMembers.value,
    memberDirectoryPage.value,
    memberDirectoryPageSize.value
  );
});

const filteredManagedMembers = computed(() => {
  const keyword = memberManageKeyword.value.trim().toLowerCase();

  return [...managedMembers.value]
    .filter((member) => {
      if (memberManageFilters.status === "ALL") {
        return true;
      }

      return member.status === memberManageFilters.status;
    })
    .filter((member) => {
      if (!keyword) {
        return true;
      }

      return matchesKeyword(
        keyword,
        member.nickname,
        member.username,
        member.reviewNote,
        member.status,
        member.approvalStatus
      );
    })
    .sort((left, right) => {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
});

const paginatedManagedMembers = computed(() => {
  return paginateItems(
    filteredManagedMembers.value,
    managedMemberPage.value,
    managedMemberPageSize.value
  );
});

const filteredPendingMembers = computed(() => {
  const keyword = pendingMemberKeyword.value.trim().toLowerCase();

  return [...pendingMembers.value]
    .filter((member) => {
      if (!keyword) {
        return true;
      }

      return matchesKeyword(
        keyword,
        member.nickname,
        member.username,
        member.reviewNote,
        member.status,
        member.approvalStatus
      );
    })
    .sort((left, right) => {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
});

const paginatedPendingMembers = computed(() => {
  return paginateItems(
    filteredPendingMembers.value,
    pendingMemberPage.value,
    pendingMemberPageSize.value
  );
});

const filteredRecords = computed(() => {
  const keyword = recordKeyword.value.trim().toLowerCase();

  return [...records.value]
    .filter((record) => {
      if (recordFilters.trackId && record.track.id !== recordFilters.trackId) {
        return false;
      }

      if (recordFilters.kartTypeId && record.kartType.id !== recordFilters.kartTypeId) {
        return false;
      }

      if (
        recordFilters.sourceType !== "ALL" &&
        record.sourceType !== recordFilters.sourceType
      ) {
        return false;
      }

      return true;
    })
    .filter((record) => {
      if (!keyword) {
        return true;
      }

      return matchesKeyword(
        keyword,
        record.member.nickname,
        record.member.username,
        record.track.name,
        record.track.location,
        record.kartType.name,
        record.kartNo,
        record.weather,
        record.note,
        record.lapTimeText
      );
    })
    .sort((left, right) => {
      return (
        new Date(right.raceDate).getTime() - new Date(left.raceDate).getTime() ||
        left.track.name.localeCompare(right.track.name, "zh-CN") ||
        left.kartType.sortOrder - right.kartType.sortOrder ||
        left.lapTimeMs - right.lapTimeMs
      );
    });
});

const paginatedRecords = computed(() => {
  return paginateItems(filteredRecords.value, recordPage.value, recordPageSize.value);
});

watch([() => memberManageFilters.status, memberManageKeyword], () => {
  managedMemberPage.value = 1;
});

watch(memberDirectoryKeyword, () => {
  memberDirectoryPage.value = 1;
});

watch([filteredDirectoryMembers, memberDirectoryPageSize], () => {
  memberDirectoryPage.value = clampPage(
    memberDirectoryPage.value,
    filteredDirectoryMembers.value.length,
    memberDirectoryPageSize.value
  );
});

watch([filteredManagedMembers, managedMemberPageSize], () => {
  managedMemberPage.value = clampPage(
    managedMemberPage.value,
    filteredManagedMembers.value.length,
    managedMemberPageSize.value
  );
});

watch(pendingMemberKeyword, () => {
  pendingMemberPage.value = 1;
});

watch([filteredPendingMembers, pendingMemberPageSize], () => {
  pendingMemberPage.value = clampPage(
    pendingMemberPage.value,
    filteredPendingMembers.value.length,
    pendingMemberPageSize.value
  );
});

watch(
  [() => recordFilters.trackId, () => recordFilters.kartTypeId, () => recordFilters.sourceType, recordKeyword],
  () => {
    recordPage.value = 1;
  }
);

watch([filteredRecords, recordPageSize], () => {
  recordPage.value = clampPage(
    recordPage.value,
    filteredRecords.value.length,
    recordPageSize.value
  );
});

onMounted(async () => {
  await loadDashboard();
});

async function loadDashboard() {
  loading.value = true;

  try {
    await Promise.all([loadBaseData(), loadPrivateData()]);

    if (hasLeaderboardFilters.value) {
      await loadLeaderboard(false);
    } else {
      leaderboardGroup.value = null;
    }
  } finally {
    loading.value = false;
  }
}

async function loadBaseData() {
  try {
    const [trackResult, kartTypeResult] = await Promise.all([
      apiFetch<{ items: Omit<TrackItem, "nameWithLocation">[] }>("/tracks"),
      apiFetch<{ items: KartTypeItem[] }>("/tracks/kart-types")
    ]);

    tracks.value = trackResult.items.map((track) => ({
      ...track,
      nameWithLocation: track.location ? `${track.name} / ${track.location}` : track.name
    }));
    kartTypes.value = kartTypeResult.items;

    if (!tracks.value.some((track) => track.id === leaderboardFilters.trackId)) {
      leaderboardFilters.trackId = "";
    }

    if (!kartTypes.value.some((kartType) => kartType.id === leaderboardFilters.kartTypeId)) {
      leaderboardFilters.kartTypeId = "";
    }

    if (!tracks.value.some((track) => track.id === recordFilters.trackId)) {
      recordFilters.trackId = "";
    }

    if (!kartTypes.value.some((kartType) => kartType.id === recordFilters.kartTypeId)) {
      recordFilters.kartTypeId = "";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "基础数据加载失败";
    ElMessage.error(message);
  }
}

async function loadPrivateData() {
  members.value = [];
  managedMembers.value = [];
  pendingMembers.value = [];
  records.value = [];

  try {
    await authStore.fetchMe();
  } catch {
    return;
  }

  await loadMembers();

  if (!isAdmin.value) {
    return;
  }

  await Promise.all([
    loadManageMembers(),
    loadPendingMembers(),
    loadRecords()
  ]);
}

async function loadMembers() {
  try {
    const memberResult = await apiFetch<{ items: MemberItem[] }>("/members");
    members.value = memberResult.items;

    if (!members.value.some((member) => member.id === recordForm.memberId)) {
      recordForm.memberId = "";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "会员列表加载失败";
    ElMessage.error(message);
  }
}

async function loadManageMembers() {
  if (!isAdmin.value) {
    managedMembers.value = [];
    return;
  }

  memberLoading.value = true;

  try {
    const result = await apiFetch<{ items: MemberItem[] }>("/members/manage");
    managedMembers.value = result.items;
  } catch (error) {
    const message = error instanceof Error ? error.message : "会员管理列表加载失败";
    ElMessage.error(message);
  } finally {
    memberLoading.value = false;
  }
}

async function loadPendingMembers() {
  if (!isAdmin.value) {
    pendingMembers.value = [];
    return;
  }

  pendingMemberLoading.value = true;

  try {
    const result = await apiFetch<{ items: MemberItem[] }>("/members/pending");
    pendingMembers.value = result.items;

    const aliveIds = new Set(result.items.map((item) => item.id));
    Object.keys(memberReviewNotes).forEach((memberId) => {
      if (!aliveIds.has(memberId)) {
        delete memberReviewNotes[memberId];
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "待审核会员加载失败";
    ElMessage.error(message);
  } finally {
    pendingMemberLoading.value = false;
  }
}

async function loadRecords() {
  if (!isAdmin.value) {
    records.value = [];
    return;
  }

  recordLoading.value = true;

  try {
    const result = await apiFetch<{ items: RecordItem[] }>("/records");
    records.value = result.items;

    if (
      editingRecordId.value &&
      !records.value.some((record) => record.id === editingRecordId.value)
    ) {
      resetRecordForm();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "正式成绩列表加载失败";
    ElMessage.error(message);
  } finally {
    recordLoading.value = false;
  }
}

async function loadLeaderboard(showSelectWarning = true) {
  if (!hasLeaderboardFilters.value) {
    leaderboardGroup.value = null;

    if (showSelectWarning) {
      ElMessage.warning("请先选择赛道和车型。");
    }
    return;
  }

  leaderboardLoading.value = true;

  try {
    const query = new URLSearchParams({
      trackId: leaderboardFilters.trackId,
      kartTypeId: leaderboardFilters.kartTypeId
    });

    const result = await apiFetch<{ groups?: LeaderboardGroup[]; items?: LeaderboardGroup[] }>(
      `/records/leaderboard?${query.toString()}`
    );

    const groups = result.groups ?? result.items ?? [];
    leaderboardGroup.value = groups[0] ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "榜单加载失败";
    ElMessage.error(message);
  } finally {
    leaderboardLoading.value = false;
  }
}

function resetLeaderboardFilters() {
  leaderboardFilters.trackId = "";
  leaderboardFilters.kartTypeId = "";
  leaderboardGroup.value = null;
}

function openDriverProfile(memberId: string) {
  void router.push(`/drivers/${memberId}`);
}

async function createTrack() {
  if (!trackForm.name.trim()) {
    ElMessage.warning("请先输入赛道名称");
    return;
  }

  trackSubmitting.value = true;

  try {
    await apiFetch<{ success: boolean; item: TrackItem }>("/tracks", {
      method: "POST",
      body: JSON.stringify({
        name: trackForm.name,
        location: normalizeOptionalText(trackForm.location),
        lengthMeters: trackForm.lengthMeters,
        layout: normalizeOptionalText(trackForm.layout),
        note: normalizeOptionalText(trackForm.note)
      })
    });

    ElMessage.success("赛道已创建。");
    resetTrackForm();
    await loadBaseData();
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建赛道失败";
    ElMessage.error(message);
  } finally {
    trackSubmitting.value = false;
  }
}

async function deleteTrack(track: TrackItem) {
  try {
    await ElMessageBox.confirm(
      `确认停用赛道“${track.name}”吗？停用后它不会再出现在提交和筛选中，但历史成绩会保留。`,
      "停用赛道",
      {
        confirmButtonText: "确认停用",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
  } catch {
    return;
  }

  deletingTrackId.value = track.id;

  try {
    await apiFetch<{ success: boolean }>(`/tracks/${track.id}`, {
      method: "DELETE"
    });
    ElMessage.success("赛道已停用。");
    await loadBaseData();

    if (hasLeaderboardFilters.value) {
      await loadLeaderboard(false);
    } else {
      leaderboardGroup.value = null;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "停用赛道失败";
    ElMessage.error(message);
  } finally {
    deletingTrackId.value = "";
  }
}

async function createMemberByAdmin() {
  if (!memberCreateForm.username.trim()) {
    ElMessage.warning("请先填写用户名。");
    return;
  }

  if (!memberCreateForm.nickname.trim()) {
    ElMessage.warning("请先填写群昵称。");
    return;
  }

  if (!memberCreateForm.password.trim()) {
    ElMessage.warning("请先填写初始密码");
    return;
  }

  memberSubmitting.value = true;

  try {
    await apiFetch<{ success: boolean; member: MemberItem }>("/members", {
      method: "POST",
      body: JSON.stringify({
        username: memberCreateForm.username,
        nickname: memberCreateForm.nickname,
        password: memberCreateForm.password
      })
    });

    ElMessage.success("会员账号已创建。");
    resetMemberCreateForm();
    await Promise.all([loadMembers(), loadManageMembers()]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建会员账号失败";
    ElMessage.error(message);
  } finally {
    memberSubmitting.value = false;
  }
}

async function toggleMemberStatus(member: MemberItem) {
  const isDisabling = member.status === "ACTIVE";
  const actionLabel = isDisabling ? "停用" : "启用";

  try {
    await ElMessageBox.confirm(
      `确认${actionLabel}会员“${member.nickname}”吗？`,
      `${actionLabel}会员`,
      {
        confirmButtonText: `确认${actionLabel}`,
        cancelButtonText: "取消",
        type: "warning"
      }
    );
  } catch {
    return;
  }

  memberStatusActionId.value = member.id;

  try {
    await apiFetch<{ success: boolean; member: MemberItem }>(
      `/members/${member.id}/${isDisabling ? "disable" : "enable"}`,
      {
        method: "PATCH"
      }
    );

    ElMessage.success(`会员已${actionLabel}。`);
    await Promise.all([loadMembers(), loadManageMembers()]);
  } catch (error) {
    const message = error instanceof Error ? error.message : `${actionLabel}会员失败`;
    ElMessage.error(message);
  } finally {
    memberStatusActionId.value = "";
  }
}

async function resetMemberPassword(member: MemberItem) {
  let value = "";

  try {
    const result = await ElMessageBox.prompt(
      `请输入会员“${member.nickname}”的新密码`,
      "重置密码",
      {
        confirmButtonText: "确认重置",
        cancelButtonText: "取消",
        inputType: "password",
        inputPattern: /^.{6,64}$/,
        inputErrorMessage: "密码长度需要在 6 到 64 位之间。"
      }
    );
    value = result.value;
  } catch {
    return;
  }

  memberPasswordActionId.value = member.id;

  try {
    await apiFetch<{ success: boolean; member: MemberItem }>(
      `/members/${member.id}/reset-password`,
      {
        method: "PATCH",
        body: JSON.stringify({
          password: value
        })
      }
    );

    ElMessage.success("密码已重置。");
    await loadManageMembers();
  } catch (error) {
    const message = error instanceof Error ? error.message : "重置密码失败";
    ElMessage.error(message);
  } finally {
    memberPasswordActionId.value = "";
  }
}

async function deleteManagedMember(member: MemberItem) {
  try {
    await ElMessageBox.confirm(
      `确认删除会员“${member.nickname}”吗？这会同时删除该会员的成绩、截图提交和登录状态，且无法恢复。`,
      "删除会员",
      {
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
  } catch {
    return;
  }

  memberDeleteActionId.value = member.id;

  try {
    await apiFetch<{ success: boolean }>(`/members/${member.id}`, {
      method: "DELETE"
    });

    ElMessage.success("会员已删除。");
    await Promise.all([
      loadMembers(),
      loadManageMembers(),
      loadPendingMembers(),
      loadRecords(),
      loadLeaderboard(false)
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除会员失败";
    ElMessage.error(message);
  } finally {
    memberDeleteActionId.value = "";
  }
}

async function approvePendingMember(member: MemberItem) {
  memberReviewActionId.value = member.id;

  try {
    await apiFetch<{ success: boolean; member: MemberItem }>(
      `/members/${member.id}/approve`,
      {
        method: "POST",
        body: JSON.stringify({
          reviewNote: memberReviewNotes[member.id] || ""
        })
      }
    );

    ElMessage.success("会员审核已通过");
    delete memberReviewNotes[member.id];
    await Promise.all([
      loadMembers(),
      loadManageMembers(),
      loadPendingMembers()
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "会员审核通过失败";
    ElMessage.error(message);
  } finally {
    memberReviewActionId.value = "";
  }
}

async function rejectPendingMember(member: MemberItem) {
  memberReviewActionId.value = member.id;

  try {
    await apiFetch<{ success: boolean; member: MemberItem }>(
      `/members/${member.id}/reject`,
      {
        method: "POST",
        body: JSON.stringify({
          reviewNote: memberReviewNotes[member.id] || ""
        })
      }
    );

    ElMessage.success("会员注册已驳回。");
    delete memberReviewNotes[member.id];
    await Promise.all([
      loadManageMembers(),
      loadPendingMembers()
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "驳回会员失败";
    ElMessage.error(message);
  } finally {
    memberReviewActionId.value = "";
  }
}

async function saveRecord() {
  if (!recordForm.memberId || !recordForm.trackId || !recordForm.kartTypeId) {
    ElMessage.warning("请先选择会员、赛道和车型");
    return;
  }

  if (!recordForm.lapTimeText.trim()) {
    ElMessage.warning("请填写圈速。");
    return;
  }

  if (!recordForm.raceDate) {
    ElMessage.warning("请选择比赛日期");
    return;
  }

  recordSubmitting.value = true;

  try {
    const payload = {
      memberId: recordForm.memberId,
      trackId: recordForm.trackId,
      kartTypeId: recordForm.kartTypeId,
      lapTimeText: recordForm.lapTimeText,
      raceDate: recordForm.raceDate,
      finalRanking: recordForm.finalRanking ?? null,
      kartNo: normalizeOptionalText(recordForm.kartNo) ?? null,
      weather: normalizeOptionalText(recordForm.weather) ?? null,
      note: normalizeOptionalText(recordForm.note) ?? null
    };

    if (editingRecordId.value) {
      await apiFetch<{ success: boolean; item: RecordItem }>(`/records/${editingRecordId.value}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      ElMessage.success("正式成绩已更新。");
    } else {
      await apiFetch<{ success: boolean; item: RecordItem }>("/records", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      ElMessage.success("正式成绩已新增。");
    }

    resetRecordForm();
    await Promise.all([loadRecords(), loadLeaderboard(false)]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存正式成绩失败";
    ElMessage.error(message);
  } finally {
    recordSubmitting.value = false;
  }
}

function startEditRecord(record: RecordItem) {
  if (record.sourceType !== "ADMIN") {
    ElMessage.warning("审核入榜的成绩暂不支持在这里直接修改");
    return;
  }

  editingRecordId.value = record.id;
  recordForm.memberId = record.member.id;
  recordForm.trackId = record.track.id;
  recordForm.kartTypeId = record.kartType.id;
  recordForm.lapTimeText = record.lapTimeText;
  recordForm.raceDate = toDateInputValue(record.raceDate);
  recordForm.finalRanking = record.finalRanking ?? undefined;
  recordForm.kartNo = record.kartNo ?? "";
  recordForm.weather = record.weather ?? "";
  recordForm.note = record.note ?? "";
}

async function deleteRecord(record: RecordItem) {
  if (record.sourceType !== "ADMIN") {
    ElMessage.warning("审核入榜的成绩暂不支持在这里直接删除");
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确认删除 ${record.member.nickname} 在 ${record.track.name} / ${record.kartType.name} 的成绩 ${record.lapTimeText} 吗？`,
      "删除正式成绩",
      {
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
  } catch {
    return;
  }

  deletingRecordId.value = record.id;

  try {
    await apiFetch<{ success: boolean }>(`/records/${record.id}`, {
      method: "DELETE"
    });
    ElMessage.success("正式成绩已删除。");

    if (editingRecordId.value === record.id) {
      resetRecordForm();
    }

    await Promise.all([loadRecords(), loadLeaderboard(false)]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除正式成绩失败";
    ElMessage.error(message);
  } finally {
    deletingRecordId.value = "";
  }
}

function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function clampPage(page: number, total: number, pageSize: number) {
  return Math.min(Math.max(page, 1), Math.max(1, Math.ceil(total / pageSize)));
}

function matchesKeyword(keyword: string, ...values: Array<string | null | undefined>) {
  return values.some((value) => value?.toLowerCase().includes(keyword));
}

function resetTrackForm() {
  trackForm.name = "";
  trackForm.location = "";
  trackForm.lengthMeters = undefined;
  trackForm.layout = "";
  trackForm.note = "";
}

function resetMemberCreateForm() {
  memberCreateForm.username = "";
  memberCreateForm.nickname = "";
  memberCreateForm.password = "";
}

function resetRecordForm() {
  editingRecordId.value = "";
  recordForm.memberId = "";
  recordForm.trackId = "";
  recordForm.kartTypeId = "";
  recordForm.lapTimeText = "";
  recordForm.raceDate = new Date().toISOString().slice(0, 10);
  recordForm.finalRanking = undefined;
  recordForm.kartNo = "";
  recordForm.weather = "";
  recordForm.note = "";
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function translateRole(role: string) {
  switch (role) {
    case "super_admin":
      return "超级管理员";
    case "admin":
      return "管理员";
    case "member":
      return "会员";
    default:
      return role;
  }
}

function formatUserStatus(status: string) {
  switch (status) {
    case "ACTIVE":
      return "正常";
    case "DISABLED":
      return "已停用";
    case "PENDING":
      return "待审核";
    case "REJECTED":
      return "已驳回";
    default:
      return status;
  }
}

function formatApprovalStatus(status: string | null) {
  switch (status) {
    case "APPROVED":
      return "已通过";
    case "PENDING":
      return "待审核";
    case "REJECTED":
      return "已驳回";
    default:
      return "-";
  }
}

function resolveStatusTagType(status: string) {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "DISABLED":
      return "info";
    case "PENDING":
      return "warning";
    case "REJECTED":
      return "danger";
    default:
      return "info";
  }
}

function resolveApprovalTagType(status: string | null) {
  switch (status) {
    case "APPROVED":
      return "success";
    case "PENDING":
      return "warning";
    case "REJECTED":
      return "danger";
    default:
      return "info";
  }
}

function formatSourceType(sourceType: RecordItem["sourceType"]) {
  return sourceType === "ADMIN" ? "管理员录入" : "审核入榜";
}

function formatTrackLength(value: number | null | undefined) {
  if (!value) {
    return "-";
  }

  return `${value} m`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("zh-CN");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN");
}

function toDateInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function buildRecordSummary(record: RecordItem) {
  const parts = [];

  if (record.finalRanking) {
    parts.push(`排名第 ${record.finalRanking} 名`);
  }

  if (record.kartNo) {
    parts.push(`车号 ${record.kartNo}`);
  }

  if (record.weather) {
    parts.push(record.weather);
  }

  if (record.note) {
    parts.push(record.note);
  }

  return parts.length > 0 ? parts.join(" / ") : "-";
}
</script>



