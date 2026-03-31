<template>
  <div class="page-stack">
    <section v-if="loading" class="panel-card form-card">
      <div class="section-heading">
        <div>
          <h2>正在加载车手资料</h2>
          <p class="support-text">正在读取会员资料、公开照片、正式成绩和个人提交记录。</p>
        </div>
      </div>
    </section>

    <template v-else-if="profile">
      <section class="panel-card hero-card profile-hero">
        <article class="driver-license-card">
          <div class="driver-license-head">
            <div>
              <p class="eyebrow">CUKA Driver Card</p>
              <h2>{{ profile.member.nickname }}</h2>
              <p class="driver-subtitle">@{{ profile.member.username }}</p>
            </div>

            <div class="driver-card-stamp">
              <span>License</span>
              <strong>{{ driverCode }}</strong>
            </div>
          </div>

          <div class="driver-license-body">
            <div class="driver-visual-stage">
              <div
                v-if="currentPhotoDisplayType === 'PORTRAIT' && (hasLocalPhotoSelection || displayedPhotoUrl)"
                class="driver-portrait-frame carbon-frame"
              >
                <div v-if="hasLocalPhotoSelection" class="crop-preview-layer">
                  <img
                    :src="localPhotoSourceUrl"
                    :alt="profile.member.nickname + ' 定妆照'"
                    class="crop-preview-media"
                    :style="cropPreviewImageStyle"
                    draggable="false"
                  />
                </div>
                <img
                  v-else
                  :src="displayedPhotoUrl"
                  :alt="profile.member.nickname + ' 定妆照'"
                  class="driver-portrait-image"
                />
              </div>

              <div v-else class="driver-avatar carbon-frame">
                <div class="driver-avatar-core">
                  <div
                    v-if="hasLocalPhotoSelection && currentPhotoDisplayType === 'AVATAR'"
                    class="crop-preview-layer crop-preview-layer-avatar"
                  >
                    <img
                      :src="localPhotoSourceUrl"
                      :alt="profile.member.nickname + ' 头像'"
                      class="crop-preview-media"
                      :style="cropPreviewImageStyle"
                      draggable="false"
                    />
                  </div>
                  <img
                    v-else-if="displayedPhotoUrl && currentPhotoDisplayType === 'AVATAR'"
                    :src="displayedPhotoUrl"
                    :alt="profile.member.nickname + ' 头像'"
                    class="driver-avatar-image"
                  />
                  <span v-else>{{ driverInitials }}</span>
                </div>
              </div>

              <p class="driver-visual-caption">
                {{ photoModeLabel }}
              </p>
            </div>

            <div class="driver-license-meta">
              <div class="driver-meta-row">
                <span>身份</span>
                <strong>{{ roleLabel }}</strong>
              </div>
              <div class="driver-meta-row">
                <span>账号状态</span>
                <strong>{{ userStatusLabel }}</strong>
              </div>
              <div class="driver-meta-row">
                <span>会员审核</span>
                <strong>{{ approvalLabel }}</strong>
              </div>
              <div class="driver-meta-row">
                <span>加入时间</span>
                <strong>{{ formatDate(profile.member.createdAt) }}</strong>
              </div>
            </div>
          </div>

          <div class="driver-license-foot">
            <div class="profile-status-chips">
              <span class="hero-pill">{{ profile.viewer.isSelf ? "我的车手卡" : "公开车手详情" }}</span>
              <span class="hero-pill">{{ profile.stats.approvedRecordCount }} 条正式成绩</span>
              <span class="hero-pill">{{ photoPublicLabel }}</span>
              <span v-if="profile.viewer.canViewPrivateSubmissions" class="hero-pill">
                {{ profile.stats.submissionCount }} 条个人提交</span>
            </div>
          </div>
        </article>

        <div class="auth-hero-side profile-hero-side">
          <article class="spotlight-card">
            <p class="spotlight-kicker">最佳正式圈速</p>
            <h3>{{ profile.stats.bestLapTimeText || "--.--" }}</h3>
            <p class="support-text">{{ bestRecordLabel }}</p>
          </article>

          <article class="spotlight-card spotlight-card-accent">
            <p class="spotlight-kicker">照片展示模式</p>
            <h3>{{ photoModeLabel }}</h3>
            <p class="support-text">
              {{ profile.viewer.canEdit ? "你上传的照片会在公开车手页展示，未登录访问者也可以查看。" : "这张公开照片会在车手卡中展示，任何访问此页的人都可以看到。" }}
            </p>
          </article>
        </div>
      </section>

      <section class="metric-row">
        <article class="metric-card">
          <span>正式成绩</span>
          <strong>{{ profile.stats.approvedRecordCount }}</strong>
          <p class="metric-copy">已进入正式圈速榜的成绩数量。</p>
        </article>
        <article class="metric-card">
          <span>覆盖赛道</span>
          <strong>{{ profile.stats.trackCount }}</strong>
          <p class="metric-copy">当前正式成绩涉及的赛道数量。</p>
        </article>
        <article class="metric-card">
          <span>覆盖车型</span>
          <strong>{{ profile.stats.kartTypeCount }}</strong>
          <p class="metric-copy">当前正式成绩涉及的车型数量。</p>
        </article>
        <article class="metric-card">
          <span>我的提交</span>
          <strong>{{ profile.viewer.canViewPrivateSubmissions ? profile.stats.submissionCount : "-" }}</strong>
          <p class="metric-copy">
            {{ profile.viewer.canViewPrivateSubmissions ? "包括待审核、已通过和已驳回的全部提交。" : "公开详情页不展示私有提交数量。" }}
          </p>
        </article>
      </section>

      <section class="section-grid profile-detail-grid">
        <section class="panel-card form-card">
          <div class="section-heading">
            <div>
              <h2>{{ profile.viewer.canEdit ? "编辑个人资料与公开照片" : "车手资料概览" }}</h2>
              <p class="support-text">
                {{ profile.viewer.canEdit ? "昵称、用户名和公开照片都会同步到车手卡与公开详情页。" : "这里展示该会员的基础资料与公开展示设定。" }}
              </p>
            </div>
            <el-button plain @click="goDashboard">返回总览</el-button>
          </div>

          <template v-if="profile.viewer.canEdit">
            <el-form label-position="top" @submit.prevent="saveProfile">
              <div class="record-form-grid">
                <el-form-item label="用户昵称">
                  <el-input v-model="editForm.nickname" placeholder="例如：阿秦 / CUKA-12" />
                </el-form-item>

                <el-form-item label="用户名">
                  <el-input v-model="editForm.username" placeholder="例如：driver_qin" />
                </el-form-item>
              </div>

              <div class="form-actions">
                <el-button :loading="saving" type="primary" @click="saveProfile">保存资料</el-button>
                <el-button @click="resetEditForm">恢复当前资料</el-button>
              </div>
            </el-form>

            <div class="photo-manager">
              <div class="section-heading">
                <div>
                  <h3>公开照片</h3>
                  <p class="support-text">
                    可上传 9:16 定妆照或 1:1 头像。照片会在车手卡和公开详情页展示，任何访问者都可以看到。</p>
                </div>
              </div>

              <div class="photo-manager-grid">
                <article class="photo-preview-panel">
                  <div
                    v-if="currentPhotoDisplayType === 'PORTRAIT' && (hasLocalPhotoSelection || displayedPhotoUrl)"
                    class="driver-portrait-frame carbon-frame photo-preview-frame"
                  >
                    <div v-if="hasLocalPhotoSelection" class="crop-preview-layer">
                      <img
                        :src="localPhotoSourceUrl"
                        :alt="profile.member.nickname + ' 定妆照预览'"
                        class="crop-preview-media"
                        :style="cropPreviewImageStyle"
                        draggable="false"
                      />
                    </div>
                    <img
                      v-else
                      :src="displayedPhotoUrl"
                      :alt="profile.member.nickname + ' 定妆照预览'"
                      class="driver-portrait-image"
                    />
                  </div>

                  <div v-else class="driver-avatar carbon-frame photo-preview-avatar">
                    <div class="driver-avatar-core">
                      <div
                        v-if="hasLocalPhotoSelection && currentPhotoDisplayType === 'AVATAR'"
                        class="crop-preview-layer crop-preview-layer-avatar"
                      >
                        <img
                          :src="localPhotoSourceUrl"
                          :alt="profile.member.nickname + ' 头像预览'"
                          class="crop-preview-media"
                          :style="cropPreviewImageStyle"
                          draggable="false"
                        />
                      </div>
                      <img
                        v-else-if="displayedPhotoUrl && currentPhotoDisplayType === 'AVATAR'"
                        :src="displayedPhotoUrl"
                        :alt="profile.member.nickname + ' 头像预览'"
                        class="driver-avatar-image"
                      />
                      <span v-else>{{ driverInitials }}</span>
                    </div>
                  </div>

                  <div class="photo-preview-meta">
                    <strong>{{ photoModeLabel }}</strong>
                    <span>{{ localPhotoFile ? "待上传：" + localPhotoFile.name : photoPublicLabel }}</span>
                    <small v-if="localPhotoFile && selectedPhotoInfo">{{ selectedPhotoInfo }}</small>
                  </div>
                </article>

                <div class="photo-upload-panel">
                  <el-form label-position="top" @submit.prevent="uploadProfilePhoto">
                    <el-form-item label="展示类型">
                      <el-radio-group v-model="photoForm.displayType">
                        <el-radio-button label="PORTRAIT">9:16 定妆照</el-radio-button>
                        <el-radio-button label="AVATAR">1:1 头像</el-radio-button>
                      </el-radio-group>
                    </el-form-item>

                    <el-form-item label="选择图片">
                      <div class="file-field profile-photo-field">
                        <input
                          class="file-picker"
                          type="file"
                          accept="image/*"
                          @change="handlePhotoFileChange"
                        />
                      </div>
                    </el-form-item>

                    <p class="muted photo-upload-hint">
                      定妆照建议使用竖版 9:16，头像建议使用正方形 1:1。边框会自动套用碳纤维纹理。</p>

                    <div v-if="localPhotoFile" class="photo-crop-panel">
                      <div class="photo-crop-summary">
                        <span class="photo-crop-chip">上传前裁切预览</span>
                        <span class="photo-crop-chip">{{ cropStageLabel }}</span>
                        <span v-if="selectedPhotoInfo" class="photo-crop-chip">{{ selectedPhotoInfo }}</span>
                      </div>

                      <div class="crop-editor-card">
                        <div class="crop-editor-head">
                          <div>
                            <strong>拖拽式裁切</strong>
                            <span>按住照片直接拖动构图，缩放后也能继续微调位置。</span>
                          </div>
                          <el-button plain @click="resetCropTransform">重置构图</el-button>
                        </div>

                        <div
                          ref="cropEditorRef"
                          class="crop-editor-shell"
                          :class="[
                            photoForm.displayType === 'PORTRAIT' ? 'is-portrait' : 'is-avatar',
                            { 'is-dragging': photoDrag.active }
                          ]"
                          @pointerdown="startPhotoCropDrag"
                          @pointermove="handlePhotoCropDrag"
                          @pointerup="finishPhotoCropDrag"
                          @pointercancel="finishPhotoCropDrag"
                          @lostpointercapture="finishPhotoCropDrag"
                        >
                          <img
                            v-if="localPhotoSourceUrl"
                            :src="localPhotoSourceUrl"
                            alt="照片裁切编辑预览"
                            class="crop-editor-image"
                            :style="cropPreviewImageStyle"
                            draggable="false"
                          />
                          <div class="crop-editor-grid" aria-hidden="true"></div>
                          <div class="crop-editor-focus-ring" aria-hidden="true"></div>
                          <div class="crop-editor-badge">{{ cropInteractionLabel }}</div>
                        </div>
                      </div>

                      <div class="crop-control-list">
                        <div class="crop-control-item">
                          <div class="crop-control-copy">
                            <strong>缩放</strong>
                            <span>把主体拉近一点，让车手卡构图更紧凑。</span>
                          </div>
                          <div class="crop-control-main">
                            <el-slider
                              v-model="photoCrop.zoomPercent"
                              :min="100"
                              :max="260"
                              :step="1"
                            />
                            <span class="crop-control-value">{{ photoCrop.zoomPercent }}%</span>
                          </div>
                        </div>

                        <div class="crop-control-item">
                          <div class="crop-control-copy">
                            <strong>左右位置</strong>
                            <span>微调横向构图，让车手或头像更居中。</span>
                          </div>
                          <div class="crop-control-main">
                            <el-slider
                              v-model="photoCrop.offsetX"
                              :min="-100"
                              :max="100"
                              :step="1"
                            />
                            <span class="crop-control-value">{{ formatCropOffset(photoCrop.offsetX) }}</span>
                          </div>
                        </div>

                        <div class="crop-control-item">
                          <div class="crop-control-copy">
                            <strong>上下位置</strong>
                            <span>定妆照可调整头顶留白和身位，头像可让面部比例更舒适。</span>
                          </div>
                          <div class="crop-control-main">
                            <el-slider
                              v-model="photoCrop.offsetY"
                              :min="-100"
                              :max="100"
                              :step="1"
                            />
                            <span class="crop-control-value">{{ formatCropOffset(photoCrop.offsetY) }}</span>
                          </div>
                        </div>
                      </div>

                      <p class="muted photo-crop-hint">
                        系统会按当前拖拽和缩放结果自动裁切后再上传，公开车手卡展示的就是这个效果。</p>
                    </div>

                    <div class="form-actions">
                      <el-button
                        :loading="photoUploading"
                        type="primary"
                        @click="uploadProfilePhoto"
                      >
                        上传公开照片
                      </el-button>
                      <el-button
                        :disabled="!localPhotoFile"
                        @click="clearLocalPhotoSelection"
                      >
                        清空待上传
                      </el-button>
                      <el-button
                        :disabled="!profile.photo"
                        :loading="photoRemoving"
                        type="danger"
                        @click="removeProfilePhoto"
                      >
                        删除当前照片
                      </el-button>
                    </div>
                  </el-form>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="profile-identity-grid">
              <article class="info-box">
                <h3>车手昵称</h3>
                <p class="module-copy">{{ profile.member.nickname }}</p>
              </article>
              <article class="info-box">
                <h3>用户名</h3>
                <p class="module-copy">@{{ profile.member.username }}</p>
              </article>
              <article class="info-box">
                <h3>公开照片</h3>
                <p class="module-copy">{{ photoModeLabel }}</p>
              </article>
              <article class="info-box">
                <h3>最近登录</h3>
                <p class="module-copy">
                  {{ profile.member.lastLoginAt ? formatDateTime(profile.member.lastLoginAt) : "暂无记录" }}
                </p>
              </article>
            </div>
          </template>
        </section>

        <section class="panel-card form-card">
          <div class="section-heading">
            <div>
              <h2>车手卡信息</h2>
              <p class="support-text">把公开照片、正式成绩和近期状态整合在一张赛车风格的车手卡里。</p>
            </div>
          </div>

          <div class="profile-identity-grid">
            <article class="info-box">
              <h3>车手编号</h3>
              <p class="module-copy">{{ driverCode }}</p>
            </article>
            <article class="info-box">
              <h3>最佳圈速</h3>
              <p class="module-copy">{{ profile.stats.bestLapTimeText || "暂无正式成绩" }}</p>
            </article>
            <article class="info-box">
              <h3>公开照片类型</h3>
              <p class="module-copy">{{ photoModeLabel }}</p>
            </article>
            <article class="info-box">
              <h3>最近更新时间</h3>
              <p class="module-copy">{{ formatDateTime(profile.member.updatedAt) }}</p>
            </article>
          </div>

          <div class="profile-note-panel">
            <p class="support-text">
              {{ profile.viewer.isSelf ? "建议头像使用清晰正方形近景，定妆照使用 9:16 竖版全身或半身图，这样车手卡展示会更完整。" : "该页展示的是此会员对外公开的车手卡信息和正式成绩。" }}
            </p>
          </div>
        </section>
      </section>

      <section class="panel-card form-card">
        <div class="section-heading">
          <div>
            <h2>正式成绩记录</h2>
            <p class="support-text">这里展示该会员已经正式入榜的成绩，可以结合赛道、车型、备注一起回看成绩背景。</p>
          </div>
        </div>

        <el-table :data="profile.records" empty-text="暂无正式成绩记录" stripe>
          <el-table-column label="排序" width="84">
            <template #default="{ $index }">
              {{ $index + 1 }}
            </template>
          </el-table-column>
          <el-table-column label="赛道" min-width="180">
            <template #default="{ row }">
              <div class="table-primary-cell">
                <strong>{{ row.track.name }}</strong>
                <span v-if="row.track.location">{{ row.track.location }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="车型" min-width="140">
            <template #default="{ row }">
              {{ row.kartType.name }}
            </template>
          </el-table-column>
          <el-table-column label="圈速" prop="lapTimeText" width="120" />
          <el-table-column label="排名" width="110">
            <template #default="{ row }">
              {{ formatRanking(row.finalRanking) }}
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="240">
            <template #default="{ row }">
              <div class="table-note-cell">
                <span>{{ row.note || "-" }}</span>
                <small v-if="row.weather">{{ row.weather }}</small>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="日期" min-width="140">
            <template #default="{ row }">
              {{ formatDate(row.raceDate) }}
            </template>
          </el-table-column>
        </el-table>
      </section>

      <section v-if="profile.viewer.canViewPrivateSubmissions" class="panel-card form-card">
        <div class="section-heading">
          <div>
            <h2>我的全部提交</h2>
            <p class="support-text">这里会展示你所有提交过的圈速申请，包括待审核、已通过、已驳回以及截图数量。</p>
          </div>
        </div>

        <div class="profile-submission-stats">
          <article class="info-box">
            <h3>待审核</h3>
            <p class="module-copy">{{ profile.stats.pendingSubmissionCount }}</p>
          </article>
          <article class="info-box">
            <h3>已通过</h3>
            <p class="module-copy">{{ profile.stats.approvedSubmissionCount }}</p>
          </article>
          <article class="info-box">
            <h3>已驳回</h3>
            <p class="module-copy">{{ profile.stats.rejectedSubmissionCount }}</p>
          </article>
        </div>

        <el-table :data="profile.submissions" empty-text="暂无提交记录" stripe>
          <el-table-column label="赛道" min-width="180">
            <template #default="{ row }">
              <div class="table-primary-cell">
                <strong>{{ row.track.name }}</strong>
                <span v-if="row.track.location">{{ row.track.location }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="车型" min-width="140">
            <template #default="{ row }">
              {{ row.kartType.name }}
            </template>
          </el-table-column>
          <el-table-column label="圈速" prop="lapTimeText" width="120" />
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="resolveSubmissionTagType(row.status)">
                {{ formatSubmissionStatus(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="220">
            <template #default="{ row }">
              <div class="table-note-cell">
                <span>{{ row.note || "-" }}</span>
                <small v-if="row.weather">{{ row.weather }}</small>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="截图" width="110">
            <template #default="{ row }">
              {{ row.attachments.length }} 张
            </template>
          </el-table-column>
          <el-table-column label="审核备注" min-width="180">
            <template #default="{ row }">
              {{ row.reviewNote || "-" }}
            </template>
          </el-table-column>
          <el-table-column label="提交时间" min-width="160">
            <template #default="{ row }">
              {{ formatDateTime(row.createdAt) }}
            </template>
          </el-table-column>
        </el-table>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRoute, useRouter } from "vue-router";

import { apiFetch } from "@/lib/http";
import { useAuthStore } from "@/stores/auth";

type PhotoDisplayType = "AVATAR" | "PORTRAIT";

interface ProfilePhoto {
  displayType: PhotoDisplayType;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  updatedAt: string | null;
  url: string;
}

interface ProfileMember {
  id: string;
  username: string;
  nickname: string;
  role: string;
  status: string;
  approvalStatus: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

interface ProfileRecord {
  id: string;
  lapTimeText: string;
  raceDate: string;
  finalRanking: number | null;
  weather: string | null;
  note: string | null;
  track: {
    id: string;
    name: string;
    location: string | null;
  };
  kartType: {
    id: string;
    code: string;
    name: string;
  };
}

interface ProfileSubmission {
  id: string;
  status: string;
  lapTimeText: string;
  raceDate: string;
  finalRanking: number | null;
  weather: string | null;
  note: string | null;
  reviewNote: string | null;
  createdAt: string;
  track: {
    id: string;
    name: string;
    location: string | null;
  };
  kartType: {
    id: string;
    code: string;
    name: string;
  };
  attachments: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    createdAt: string;
    downloadPath: string;
  }>;
}

interface ProfileResponse {
  viewer: {
    isSelf: boolean;
    canEdit: boolean;
    canViewPrivateSubmissions: boolean;
  };
  member: ProfileMember;
  photo: ProfilePhoto | null;
  stats: {
    bestLapTimeText: string | null;
    approvedRecordCount: number;
    submissionCount: number;
    approvedSubmissionCount: number;
    pendingSubmissionCount: number;
    rejectedSubmissionCount: number;
    trackCount: number;
    kartTypeCount: number;
  };
  records: ProfileRecord[];
  submissions: ProfileSubmission[];
}

const PHOTO_OUTPUT_SIZE: Record<PhotoDisplayType, { width: number; height: number }> = {
  AVATAR: {
    width: 1080,
    height: 1080
  },
  PORTRAIT: {
    width: 1080,
    height: 1920
  }
};

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const saving = ref(false);
const photoUploading = ref(false);
const photoRemoving = ref(false);
const profile = ref<ProfileResponse | null>(null);
const localPhotoFile = ref<File | null>(null);
const localPhotoPreviewUrl = ref("");
const localPhotoSourceUrl = ref("");

const photoCrop = reactive({
  zoomPercent: 100,
  offsetX: 0,
  offsetY: 0,
  naturalWidth: 0,
  naturalHeight: 0
});

const cropEditorRef = ref<HTMLElement | null>(null);
const photoDrag = reactive({
  active: false,
  pointerId: -1,
  startClientX: 0,
  startClientY: 0,
  startCropX: 0,
  startCropY: 0,
  cropWidth: 0,
  cropHeight: 0
});

let localPhotoImage: HTMLImageElement | null = null;
let photoPreviewRefreshToken = 0;

const editForm = reactive({
  username: "",
  nickname: ""
});

const photoForm = reactive({
  displayType: "PORTRAIT" as PhotoDisplayType
});

authStore.initialize();

const bestRecord = computed(() => profile.value?.records[0] ?? null);

const bestRecordLabel = computed(() => {
  if (!bestRecord.value) {
    return "还没有正式录入的圈速成绩。";
  }

  const location = bestRecord.value.track.location
    ? ` / ${bestRecord.value.track.location}`
    : "";
  return `${bestRecord.value.track.name}${location} / ${bestRecord.value.kartType.name}`;
});

const driverInitials = computed(() => {
  const source = profile.value?.member.nickname || profile.value?.member.username || "CU";
  return Array.from(source.replace(/\s+/g, "")).slice(0, 2).join("").toUpperCase();
});

const driverCode = computed(() => {
  if (!profile.value) {
    return "CUKA-0000";
  }

  const joinYear = new Date(profile.value.member.createdAt).getFullYear();
  const shortId = profile.value.member.id.slice(-4).toUpperCase();
  return `${joinYear}-${shortId}`;
});

const roleLabel = computed(() => translateRole(profile.value?.member.role ?? ""));
const userStatusLabel = computed(() => formatUserStatus(profile.value?.member.status ?? ""));
const approvalLabel = computed(() =>
  formatApprovalStatus(profile.value?.member.approvalStatus ?? null)
);
const hasLocalPhotoSelection = computed(() => Boolean(localPhotoFile.value && localPhotoSourceUrl.value));
const cropZoom = computed(() => photoCrop.zoomPercent / 100);

const displayedPhotoUrl = computed(() => {
  return localPhotoPreviewUrl.value || localPhotoSourceUrl.value || profile.value?.photo?.url || "";
});

const currentPhotoDisplayType = computed<PhotoDisplayType | null>(() => {
  if (hasLocalPhotoSelection.value) {
    return photoForm.displayType;
  }

  return profile.value?.photo?.displayType ?? null;
});

const photoModeLabel = computed(() => {
  switch (currentPhotoDisplayType.value) {
    case "PORTRAIT":
      return "9:16 定妆照展示";
    case "AVATAR":
      return "1:1 头像展示";
    default:
      return "未上传公开照片";
  }
});

const photoPublicLabel = computed(() => {
  return profile.value?.photo ? "公开照片已启用" : "当前无公开照片";
});

const cropStageLabel = computed(() => {
  const output = PHOTO_OUTPUT_SIZE[photoForm.displayType];
  const label = photoForm.displayType === "PORTRAIT" ? "9:16 车手卡定妆照" : "1:1 头像";
  return `${label} / ${output.width} x ${output.height}`;
});

const selectedPhotoInfo = computed(() => {
  if (!localPhotoFile.value || !photoCrop.naturalWidth || !photoCrop.naturalHeight) {
    return "";
  }

  return `${photoCrop.naturalWidth} x ${photoCrop.naturalHeight} / ${formatFileSize(
    localPhotoFile.value.size
  )}`;
});

const cropPreviewImageStyle = computed(() => {
  if (!hasLocalPhotoSelection.value || !photoCrop.naturalWidth || !photoCrop.naturalHeight) {
    return {};
  }

  const cropRect = calculateCropRect(
    photoCrop.naturalWidth,
    photoCrop.naturalHeight,
    photoForm.displayType
  );

  return {
    width: `${(photoCrop.naturalWidth / cropRect.width) * 100}%`,
    height: `${(photoCrop.naturalHeight / cropRect.height) * 100}%`,
    left: `${-(cropRect.x / cropRect.width) * 100}%`,
    top: `${-(cropRect.y / cropRect.height) * 100}%`
  };
});

const cropInteractionLabel = computed(() => {
  if (photoDrag.active) {
    return "正在拖拽";
  }

  return photoForm.displayType === "PORTRAIT" ? "拖动照片调整车手卡构图" : "拖动照片调整头像构图";
});

watch(
  () => route.fullPath,
  () => {
    void loadProfile();
  },
  {
    immediate: true
  }
);

watch(
  () => profile.value?.photo?.displayType,
  (displayType) => {
    if (!localPhotoFile.value) {
      photoForm.displayType = displayType ?? "PORTRAIT";
    }
  },
  {
    immediate: true
  }
);

watch(
  () => photoForm.displayType,
  (nextDisplayType, previousDisplayType) => {
    if (
      hasLocalPhotoSelection.value &&
      previousDisplayType &&
      nextDisplayType !== previousDisplayType
    ) {
      resetCropTransform();
    }
  }
);

onBeforeUnmount(() => {
  revokeLocalPhotoSource();
  revokeLocalPhotoPreview();
});

async function loadProfile() {
  loading.value = true;

  try {
    const path =
      route.name === "driver-profile"
        ? `/members/${String(route.params.memberId)}/profile`
        : "/members/me/profile";
    const result = await apiFetch<ProfileResponse>(path);
    profile.value = result;
    resetEditForm();
  } catch (error) {
    const message = error instanceof Error ? error.message : "车手资料加载失败";
    ElMessage.error(message);
  } finally {
    loading.value = false;
  }
}

async function saveProfile() {
  if (!profile.value?.viewer.canEdit) {
    return;
  }

  saving.value = true;

  try {
    await apiFetch<{ success: boolean; user: ProfileMember }>("/members/me/profile", {
      method: "PATCH",
      body: JSON.stringify({
        username: editForm.username,
        nickname: editForm.nickname
      })
    });

    await authStore.fetchMe();
    await loadProfile();
    ElMessage.success("个人资料已更新");
  } catch (error) {
    const message = error instanceof Error ? error.message : "个人资料更新失败";
    ElMessage.error(message);
  } finally {
    saving.value = false;
  }
}

async function uploadProfilePhoto() {
  if (!profile.value?.viewer.canEdit) {
    return;
  }

  if (!localPhotoFile.value) {
    ElMessage.warning("请先选择一张图片。");
    return;
  }

  photoUploading.value = true;

  try {
    const croppedFile = await buildCroppedPhotoFile();
    const formData = new FormData();
    formData.append("displayType", photoForm.displayType);
    formData.append("file", croppedFile);

    await apiFetch<{ success: boolean }>("/members/me/photo", {
      method: "POST",
      body: formData
    });

    clearLocalPhotoSelection();
    await loadProfile();
    ElMessage.success("公开照片已更新");
  } catch (error) {
    const message = error instanceof Error ? error.message : "公开照片上传失败";
    ElMessage.error(message);
  } finally {
    photoUploading.value = false;
  }
}

async function removeProfilePhoto() {
  if (!profile.value?.viewer.canEdit || !profile.value.photo) {
    return;
  }

  try {
    await ElMessageBox.confirm(
      "删除后车手卡将恢复为默认字母占位，公开页也不再显示这张照片。确定继续吗？",
      "删除公开照片",
      {
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
  } catch {
    return;
  }

  photoRemoving.value = true;

  try {
    await apiFetch<{ success: boolean }>("/members/me/photo", {
      method: "DELETE"
    });

    clearLocalPhotoSelection();
    await loadProfile();
    ElMessage.success("公开照片已删除");
  } catch (error) {
    const message = error instanceof Error ? error.message : "公开照片删除失败";
    ElMessage.error(message);
  } finally {
    photoRemoving.value = false;
  }
}

async function handlePhotoFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0] ?? null;

  if (!file) {
    return;
  }

  target.value = "";

  if (!file.type.startsWith("image/")) {
    ElMessage.warning("请选择图片文件后再上传。");
    return;
  }

  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageFromUrl(sourceUrl);
    localPhotoFile.value = file;
    localPhotoImage = image;
    setLocalPhotoSourceUrl(sourceUrl);
    resetPhotoCrop();
    photoCrop.naturalWidth = image.naturalWidth;
    photoCrop.naturalHeight = image.naturalHeight;
  } catch {
    URL.revokeObjectURL(sourceUrl);
    ElMessage.error("图片读取失败，请更换图片后重试。");
  }
}

async function refreshLocalPhotoPreview() {
  if (!localPhotoFile.value || !localPhotoSourceUrl.value) {
    revokeLocalPhotoPreview();
    return;
  }

  const token = ++photoPreviewRefreshToken;

  try {
    const blob = await renderCroppedPhotoBlob();

    if (!blob || token !== photoPreviewRefreshToken) {
      return;
    }

    setLocalPhotoPreviewUrl(URL.createObjectURL(blob));
  } catch (error) {
    if (token === photoPreviewRefreshToken) {
      console.error("Failed to refresh local photo preview", error);
    }
  }
}

function setLocalPhotoPreviewUrl(url: string) {
  const previousUrl = localPhotoPreviewUrl.value;
  localPhotoPreviewUrl.value = url;

  if (previousUrl) {
    URL.revokeObjectURL(previousUrl);
  }
}

function setLocalPhotoSourceUrl(url: string) {
  const previousUrl = localPhotoSourceUrl.value;
  localPhotoSourceUrl.value = url;

  if (previousUrl) {
    URL.revokeObjectURL(previousUrl);
  }
}

function revokeLocalPhotoPreview() {
  if (localPhotoPreviewUrl.value) {
    URL.revokeObjectURL(localPhotoPreviewUrl.value);
    localPhotoPreviewUrl.value = "";
  }
}

function revokeLocalPhotoSource() {
  if (localPhotoSourceUrl.value) {
    URL.revokeObjectURL(localPhotoSourceUrl.value);
    localPhotoSourceUrl.value = "";
  }
}

function clearLocalPhotoSelection() {
  finishPhotoCropDrag();
  photoPreviewRefreshToken += 1;
  localPhotoImage = null;
  localPhotoFile.value = null;
  resetPhotoCrop();
  revokeLocalPhotoSource();
  revokeLocalPhotoPreview();
  photoForm.displayType = profile.value?.photo?.displayType ?? "PORTRAIT";
}

function resetPhotoCrop() {
  photoCrop.zoomPercent = 100;
  photoCrop.offsetX = 0;
  photoCrop.offsetY = 0;
  photoCrop.naturalWidth = 0;
  photoCrop.naturalHeight = 0;
}

function resetCropTransform() {
  photoCrop.zoomPercent = 100;
  photoCrop.offsetX = 0;
  photoCrop.offsetY = 0;
}

function startPhotoCropDrag(event: PointerEvent) {
  if (!hasLocalPhotoSelection.value || !cropEditorRef.value || !photoCrop.naturalWidth || !photoCrop.naturalHeight) {
    return;
  }

  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  const cropRect = calculateCropRect(
    photoCrop.naturalWidth,
    photoCrop.naturalHeight,
    photoForm.displayType
  );

  photoDrag.active = true;
  photoDrag.pointerId = event.pointerId;
  photoDrag.startClientX = event.clientX;
  photoDrag.startClientY = event.clientY;
  photoDrag.startCropX = cropRect.x;
  photoDrag.startCropY = cropRect.y;
  photoDrag.cropWidth = cropRect.width;
  photoDrag.cropHeight = cropRect.height;

  cropEditorRef.value.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function handlePhotoCropDrag(event: PointerEvent) {
  if (!photoDrag.active || event.pointerId !== photoDrag.pointerId || !cropEditorRef.value) {
    return;
  }

  const bounds = cropEditorRef.value.getBoundingClientRect();

  if (!bounds.width || !bounds.height) {
    return;
  }

  const scaleX = bounds.width / photoDrag.cropWidth;
  const scaleY = bounds.height / photoDrag.cropHeight;
  const deltaCropX = (event.clientX - photoDrag.startClientX) / scaleX;
  const deltaCropY = (event.clientY - photoDrag.startClientY) / scaleY;
  const nextCropX = clamp(
    photoDrag.startCropX - deltaCropX,
    0,
    Math.max(photoCrop.naturalWidth - photoDrag.cropWidth, 0)
  );
  const nextCropY = clamp(
    photoDrag.startCropY - deltaCropY,
    0,
    Math.max(photoCrop.naturalHeight - photoDrag.cropHeight, 0)
  );

  applyCropRectPosition(nextCropX, nextCropY, photoDrag.cropWidth, photoDrag.cropHeight);
  event.preventDefault();
}

function finishPhotoCropDrag(event?: PointerEvent | Event) {
  if (!photoDrag.active) {
    return;
  }

  const pointerEvent =
    event instanceof PointerEvent ? event : null;

  if (pointerEvent && pointerEvent.pointerId !== photoDrag.pointerId) {
    return;
  }

  if (cropEditorRef.value && photoDrag.pointerId >= 0 && cropEditorRef.value.hasPointerCapture(photoDrag.pointerId)) {
    cropEditorRef.value.releasePointerCapture(photoDrag.pointerId);
  }

  photoDrag.active = false;
  photoDrag.pointerId = -1;
}

function applyCropRectPosition(cropX: number, cropY: number, cropWidth: number, cropHeight: number) {
  const horizontalRoom = Math.max(photoCrop.naturalWidth - cropWidth, 0);
  const verticalRoom = Math.max(photoCrop.naturalHeight - cropHeight, 0);
  const alignX = horizontalRoom === 0 ? 0.5 : cropX / horizontalRoom;
  const alignY = verticalRoom === 0 ? 0.5 : cropY / verticalRoom;

  photoCrop.offsetX = denormalizeCropOffset(alignX);
  photoCrop.offsetY = denormalizeCropOffset(alignY);
}

async function buildCroppedPhotoFile() {
  const sourceFile = localPhotoFile.value;

  if (!sourceFile) {
    throw new Error("请先选择要上传的图片。");
  }

  const blob = await renderCroppedPhotoBlob();

  if (!blob) {
    throw new Error("照片裁切失败，请重新选择图片后重试。");
  }

  const mimeType = blob.type || resolveOutputMimeType(sourceFile);
  const extension = resolvePhotoExtension(mimeType);
  const fileName = `${stripFileExtension(sourceFile.name)}-${photoForm.displayType.toLowerCase()}.${extension}`;

  return new File([blob], fileName, {
    type: mimeType,
    lastModified: Date.now()
  });
}

async function renderCroppedPhotoBlob() {
  const image = await ensureLocalPhotoImage();
  const output = PHOTO_OUTPUT_SIZE[photoForm.displayType];
  const cropRect = calculateCropRect(
    image.naturalWidth,
    image.naturalHeight,
    photoForm.displayType
  );
  const canvas = document.createElement("canvas");

  canvas.width = output.width;
  canvas.height = output.height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("当前浏览器无法处理图片裁切。");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    0,
    0,
    output.width,
    output.height
  );

  const mimeType = resolveOutputMimeType(localPhotoFile.value);

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, mimeType === "image/png" ? undefined : 0.92);
  });
}

async function ensureLocalPhotoImage() {
  if (localPhotoImage) {
    return localPhotoImage;
  }

  if (!localPhotoSourceUrl.value) {
    throw new Error("未找到本地图片源。");
  }

  localPhotoImage = await loadImageFromUrl(localPhotoSourceUrl.value);
  return localPhotoImage;
}

function calculateCropRect(sourceWidth: number, sourceHeight: number, displayType: PhotoDisplayType) {
  const output = PHOTO_OUTPUT_SIZE[displayType];
  const targetRatio = output.width / output.height;
  const sourceRatio = sourceWidth / sourceHeight;

  let baseCropWidth = sourceWidth;
  let baseCropHeight = sourceHeight;

  if (sourceRatio > targetRatio) {
    baseCropWidth = sourceHeight * targetRatio;
  } else {
    baseCropHeight = sourceWidth / targetRatio;
  }

  const cropWidth = baseCropWidth / clamp(cropZoom.value, 1, 2.6);
  const cropHeight = baseCropHeight / clamp(cropZoom.value, 1, 2.6);
  const alignX = normalizeCropOffset(photoCrop.offsetX);
  const alignY = normalizeCropOffset(photoCrop.offsetY);

  return {
    x: (sourceWidth - cropWidth) * alignX,
    y: (sourceHeight - cropHeight) * alignY,
    width: cropWidth,
    height: cropHeight
  };
}

function normalizeCropOffset(offset: number) {
  return clamp((offset + 100) / 200, 0, 1);
}

function denormalizeCropOffset(alignment: number) {
  return Math.round(clamp(alignment, 0, 1) * 200 - 100);
}

function resolveOutputMimeType(file: File | null) {
  if (file?.type === "image/png") {
    return "image/png";
  }

  if (file?.type === "image/webp") {
    return "image/webp";
  }

  return "image/jpeg";
}

function resolvePhotoExtension(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || "profile-photo";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function loadImageFromUrl(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = url;
  });
}

function resetEditForm() {
  editForm.username = profile.value?.member.username ?? "";
  editForm.nickname = profile.value?.member.nickname ?? "";
}

function goDashboard() {
  void router.push("/dashboard");
}

function formatCropOffset(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatRanking(value: number | null) {
  return value ? `第 ${value} 名` : "-";
}

function translateRole(role: string) {
  switch (role) {
    case "super_admin":
      return "超级管理员";
    case "admin":
      return "管理员";
    case "member":
      return "会员车手";
    default:
      return role || "-";
  }
}

function formatUserStatus(status: string) {
  switch (status) {
    case "ACTIVE":
      return "正常启用";
    case "PENDING":
      return "待审核";
    case "REJECTED":
      return "已驳回";
    case "DISABLED":
      return "已停用";
    default:
      return status || "-";
  }
}

function formatApprovalStatus(status: string | null) {
  switch (status) {
    case "APPROVED":
      return "已通过";
    case "PENDING":
      return "待审核";
    case "REJECTED":
      return "未通过";
    default:
      return "不适用";
  }
}

function formatSubmissionStatus(status: string) {
  switch (status) {
    case "PENDING":
      return "待审核";
    case "APPROVED":
      return "已通过";
    case "REJECTED":
      return "已驳回";
    case "CANCELLED":
      return "已取消";
    default:
      return status;
  }
}

function resolveSubmissionTagType(status: string) {
  switch (status) {
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "danger";
    case "PENDING":
      return "warning";
    default:
      return "info";
  }
}
</script>
