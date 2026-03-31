<template>
  <div class="page-stack">
    <section class="panel-card hero-card dashboard-hero">
      <div class="hero-copy">
        <p class="eyebrow">CUKA在线圈速榜</p>
        <h2>成绩提交与审核中心</h2>
        <p>
          会员可以在这里提交个人圈速并上传截图，管理员在这里完成审核。审核通过后，成绩会自动写入正式榜单，
          并保留车型、最终排名、天气和备注信息。
        </p>

        <div class="hero-pills">
          <span class="hero-pill">截图佐证上传</span>
          <span class="hero-pill">管理员逐条审核</span>
          <span class="hero-pill">通过后自动入榜</span>
        </div>
      </div>

      <div class="auth-hero-side">
        <article class="spotlight-card">
          <p class="spotlight-kicker">提交说明</p>
          <h3>一条成绩对应一次申请</h3>
          <p class="support-text">
            建议同步填写天气、低温、雨天、抓地变化等备注，方便管理员审核和后续查榜。
          </p>
        </article>

        <article class="spotlight-card spotlight-card-accent">
          <p class="spotlight-kicker">审核标准</p>
          <h3>截图清晰、信息完整</h3>
          <p class="support-text">
            截图越清晰、信息越完整，管理员审核越高效，正式榜单的可信度也越高。
          </p>
        </article>
      </div>
    </section>

    <section v-if="!authStore.isAuthenticated" class="panel-card form-card">
      <h2>需要先登录</h2>
      <p class="support-text">
        请先返回登录页，登录后再进入成绩提交与审核中心。
      </p>
    </section>

    <template v-else>
      <section v-if="!isAdmin" class="section-grid submission-layout">
        <section class="panel-card form-card">
          <div class="section-heading">
            <div>
              <h2>提交成绩申请</h2>
              <p class="support-text">
                提交后状态默认为“待审核”。如果附带截图，管理员审核会更高效、更准确。
              </p>
            </div>
          </div>

          <el-form label-position="top" @submit.prevent="submitRecord">
            <div class="record-form-grid">
              <el-form-item label="赛道">
                <el-select v-model="submissionForm.trackId" placeholder="请选择赛道">
                  <el-option
                    v-for="track in tracks"
                    :key="track.id"
                    :label="track.name"
                    :value="track.id"
                  />
                </el-select>
              </el-form-item>

              <el-form-item label="车型">
                <el-select v-model="submissionForm.kartTypeId" placeholder="请选择车型">
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
                  v-model="submissionForm.lapTimeText"
                  placeholder="例如：49.632 或 1:08.532"
                />
              </el-form-item>

              <el-form-item label="比赛日期">
                <el-date-picker
                  v-model="submissionForm.raceDate"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="请选择日期"
                />
              </el-form-item>
            </div>

            <div class="record-form-grid">
              <el-form-item label="最终排名">
                <el-input-number
                  v-model="submissionForm.finalRanking"
                  :min="1"
                  :step="1"
                  controls-position="right"
                />
              </el-form-item>

              <el-form-item label="车号">
                <el-input v-model="submissionForm.kartNo" placeholder="例如：12" />
              </el-form-item>
            </div>

            <div class="record-form-grid">
              <el-form-item label="天气">
                <el-input
                  v-model="submissionForm.weather"
                  placeholder="例如：晴 / 阴 / 小雨"
                />
              </el-form-item>

              <el-form-item label="备注">
                <el-input
                  v-model="submissionForm.note"
                  :rows="3"
                  placeholder="例如：雨天、低温、后半程抓地下降"
                  type="textarea"
                />
              </el-form-item>
            </div>

            <el-form-item label="成绩截图">
              <div class="file-field">
                <input
                  class="file-picker"
                  type="file"
                  accept="image/*"
                  multiple
                  @change="handleFileChange"
                />
                <div v-if="selectedFileNames.length > 0" class="file-list">
                  <span
                    v-for="fileName in selectedFileNames"
                    :key="fileName"
                    class="file-chip"
                  >
                    {{ fileName }}
                  </span>
                </div>
              </div>
            </el-form-item>

            <div class="form-actions">
              <el-button :loading="submitting" type="primary" @click="submitRecord">
                提交成绩申请
              </el-button>
            </div>
          </el-form>
        </section>

        <section class="panel-card form-card">
          <div class="section-heading">
            <div>
              <h2>我的申请记录</h2>
              <p class="support-text">
                这里会显示审核状态、备注和截图数量，方便你随时回看自己的提交历史。
              </p>
            </div>
            <el-button :loading="loading" @click="loadPage">刷新</el-button>
          </div>

          <div class="record-filter-grid">
            <section class="info-box">
              <h3>待审核</h3>
              <p class="module-copy">{{ submissionStats.pending }} 条</p>
            </section>
            <section class="info-box">
              <h3>已通过</h3>
              <p class="module-copy">{{ submissionStats.approved }} 条</p>
            </section>
            <section class="info-box">
              <h3>已驳回</h3>
              <p class="module-copy">{{ submissionStats.rejected }} 条</p>
            </section>
            <section class="info-box">
              <h3>关键词搜索</h3>
              <el-input
                v-model="mySubmissionKeyword"
                clearable
                placeholder="搜索赛道、车型、圈速、备注"
              />
            </section>
          </div>

          <p class="muted">
            当前显示 {{ filteredMySubmissions.length }} / {{ mySubmissions.length }} 条申请
          </p>

          <el-table :data="paginatedMySubmissions" empty-text="你还没有提交过成绩申请" stripe>
            <el-table-column label="赛道">
              <template #default="{ row }">
                {{ row.track.name }}
              </template>
            </el-table-column>
            <el-table-column label="车型">
              <template #default="{ row }">
                {{ row.kartType.name }}
              </template>
            </el-table-column>
            <el-table-column label="圈速" prop="lapTimeText" />
            <el-table-column label="状态">
              <template #default="{ row }">
                <el-tag :type="resolveSubmissionTagType(row.status)">
                  {{ formatSubmissionStatus(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="200">
              <template #default="{ row }">
                {{ row.note || "-" }}
              </template>
            </el-table-column>
            <el-table-column label="截图">
              <template #default="{ row }">
                {{ row.attachments.length }} 张
              </template>
            </el-table-column>
            <el-table-column label="审核备注" min-width="180">
              <template #default="{ row }">
                {{ row.reviewNote || "-" }}
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            v-if="filteredMySubmissions.length > mySubmissionPageSize"
            v-model:current-page="mySubmissionPage"
            v-model:page-size="mySubmissionPageSize"
            :page-sizes="[10, 20, 50]"
            :total="filteredMySubmissions.length"
            background
            class="table-pagination"
            layout="total, sizes, prev, pager, next"
          />
        </section>
      </section>

      <section v-else class="panel-card form-card">
        <div class="section-heading">
          <div>
            <h2>待审核成绩</h2>
            <p class="support-text">
              管理员可以查看截图、填写审核备注，并在通过后自动写入正式榜单。
            </p>
          </div>
          <el-button :loading="loading" @click="loadPage">刷新</el-button>
        </div>

        <div class="record-filter-grid">
          <section class="info-box">
            <h3>待审核总数</h3>
            <p class="module-copy">{{ pendingSubmissions.length }} 条</p>
          </section>
          <section class="info-box">
            <h3>关键词搜索</h3>
            <el-input
              v-model="pendingSubmissionKeyword"
              clearable
              placeholder="搜索会员、赛道、车型、圈速"
            />
          </section>
        </div>

        <div v-if="filteredPendingSubmissions.length === 0" class="empty-hint">
          当前没有待审核的成绩申请。
        </div>

        <div v-else class="card-list">
          <article
            v-for="submission in paginatedPendingSubmissions"
            :key="submission.id"
            class="submission-card"
          >
            <div class="section-heading">
              <div>
                <h3>
                  {{ submission.member.nickname }} / {{ submission.track.name }} /
                  {{ submission.kartType.name }}
                </h3>
                <p class="support-text">
                  圈速 {{ submission.lapTimeText }} / 日期 {{ formatDate(submission.raceDate) }}
                </p>
              </div>
              <el-tag type="warning">{{ formatSubmissionStatus(submission.status) }}</el-tag>
            </div>

            <div class="meta-grid">
              <div class="info-box">
                <h3>最终排名</h3>
                <p class="module-copy">
                  {{ submission.finalRanking ? `第 ${submission.finalRanking} 名` : '-' }}
                </p>
              </div>
              <div class="info-box">
                <h3>车号</h3>
                <p class="module-copy">{{ submission.kartNo || '-' }}</p>
              </div>
              <div class="info-box">
                <h3>天气</h3>
                <p class="module-copy">{{ submission.weather || '-' }}</p>
              </div>
              <div class="info-box">
                <h3>备注</h3>
                <p class="module-copy">{{ submission.note || '-' }}</p>
              </div>
            </div>

            <div class="attachment-row">
              <strong>成绩截图</strong>
              <div v-if="submission.attachments.length === 0" class="support-text">
                暂无截图
              </div>
              <div v-else class="inline-actions">
                <el-button
                  v-for="attachment in submission.attachments"
                  :key="attachment.id"
                  size="small"
                  @click="openAttachment(attachment)"
                >
                  查看 {{ attachment.fileName }}
                </el-button>
              </div>
            </div>

            <el-form label-position="top">
              <el-form-item label="审核备注">
                <el-input
                  v-model="reviewNotes[submission.id]"
                  :rows="2"
                  placeholder="例如：截图清晰，成绩有效 / 截图不完整，请补充"
                  type="textarea"
                />
              </el-form-item>

              <div class="inline-actions">
                <el-button
                  :loading="reviewingId === submission.id"
                  type="success"
                  @click="approveSubmission(submission.id)"
                >
                  审核通过并入榜
                </el-button>
                <el-button
                  :loading="reviewingId === submission.id"
                  type="danger"
                  @click="rejectSubmission(submission.id)"
                >
                  驳回申请
                </el-button>
              </div>
            </el-form>
          </article>
        </div>

        <el-pagination
          v-if="filteredPendingSubmissions.length > pendingSubmissionPageSize"
          v-model:current-page="pendingSubmissionPage"
          v-model:page-size="pendingSubmissionPageSize"
          :page-sizes="[6, 12, 24]"
          :total="filteredPendingSubmissions.length"
          background
          class="table-pagination"
          layout="total, sizes, prev, pager, next"
        />
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";

import { readStoredAuth } from "@/lib/auth-storage";
import { apiFetch } from "@/lib/http";
import { useAuthStore } from "@/stores/auth";

interface TrackItem {
  id: string;
  name: string;
}

interface KartTypeItem {
  id: string;
  name: string;
}

interface SubmissionAttachmentItem {
  id: string;
  fileName: string;
  downloadPath: string;
}

interface SubmissionItem {
  id: string;
  status: string;
  lapTimeText: string;
  raceDate: string;
  finalRanking: number | null;
  kartNo: string | null;
  weather: string | null;
  note: string | null;
  reviewNote: string | null;
  member: {
    nickname: string;
  };
  track: {
    name: string;
  };
  kartType: {
    name: string;
  };
  attachments: SubmissionAttachmentItem[];
}

const authStore = useAuthStore();
const loading = ref(false);
const submitting = ref(false);
const reviewingId = ref("");
const tracks = ref<TrackItem[]>([]);
const kartTypes = ref<KartTypeItem[]>([]);
const mySubmissions = ref<SubmissionItem[]>([]);
const pendingSubmissions = ref<SubmissionItem[]>([]);
const selectedFiles = ref<File[]>([]);
const reviewNotes = reactive<Record<string, string>>({});
const mySubmissionKeyword = ref("");
const pendingSubmissionKeyword = ref("");
const mySubmissionPage = ref(1);
const mySubmissionPageSize = ref(10);
const pendingSubmissionPage = ref(1);
const pendingSubmissionPageSize = ref(6);

const submissionForm = reactive({
  trackId: "",
  kartTypeId: "",
  lapTimeText: "",
  raceDate: new Date().toISOString().slice(0, 10),
  finalRanking: undefined as number | undefined,
  kartNo: "",
  weather: "",
  note: ""
});

authStore.initialize();

const isAdmin = computed(
  () => authStore.role === "admin" || authStore.role === "super_admin"
);

const selectedFileNames = computed(() =>
  selectedFiles.value.map((file) => file.name)
);

const submissionStats = computed(() => {
  return mySubmissions.value.reduce(
    (summary, submission) => {
      if (submission.status === "APPROVED") {
        summary.approved += 1;
      } else if (submission.status === "REJECTED") {
        summary.rejected += 1;
      } else {
        summary.pending += 1;
      }

      return summary;
    },
    {
      pending: 0,
      approved: 0,
      rejected: 0
    }
  );
});

const filteredMySubmissions = computed(() => {
  const keyword = mySubmissionKeyword.value.trim().toLowerCase();

  return [...mySubmissions.value]
    .filter((submission) => {
      if (!keyword) {
        return true;
      }

      return matchesKeyword(
        keyword,
        submission.track.name,
        submission.kartType.name,
        submission.lapTimeText,
        submission.note,
        submission.reviewNote,
        submission.weather,
        submission.kartNo
      );
    })
    .sort((left, right) => {
      return new Date(right.raceDate).getTime() - new Date(left.raceDate).getTime();
    });
});

const paginatedMySubmissions = computed(() => {
  return paginateItems(
    filteredMySubmissions.value,
    mySubmissionPage.value,
    mySubmissionPageSize.value
  );
});

const filteredPendingSubmissions = computed(() => {
  const keyword = pendingSubmissionKeyword.value.trim().toLowerCase();

  return [...pendingSubmissions.value]
    .filter((submission) => {
      if (!keyword) {
        return true;
      }

      return matchesKeyword(
        keyword,
        submission.member.nickname,
        submission.track.name,
        submission.kartType.name,
        submission.lapTimeText,
        submission.note,
        submission.weather,
        submission.kartNo
      );
    })
    .sort((left, right) => {
      return new Date(right.raceDate).getTime() - new Date(left.raceDate).getTime();
    });
});

const paginatedPendingSubmissions = computed(() => {
  return paginateItems(
    filteredPendingSubmissions.value,
    pendingSubmissionPage.value,
    pendingSubmissionPageSize.value
  );
});

watch(mySubmissionKeyword, () => {
  mySubmissionPage.value = 1;
});

watch([filteredMySubmissions, mySubmissionPageSize], () => {
  mySubmissionPage.value = clampPage(
    mySubmissionPage.value,
    filteredMySubmissions.value.length,
    mySubmissionPageSize.value
  );
});

watch(pendingSubmissionKeyword, () => {
  pendingSubmissionPage.value = 1;
});

watch([filteredPendingSubmissions, pendingSubmissionPageSize], () => {
  pendingSubmissionPage.value = clampPage(
    pendingSubmissionPage.value,
    filteredPendingSubmissions.value.length,
    pendingSubmissionPageSize.value
  );
});

onMounted(async () => {
  await loadPage();
});

async function loadPage() {
  loading.value = true;

  try {
    if (!authStore.isAuthenticated) {
      return;
    }

    await authStore.fetchMe();

    const [trackResult, kartTypeResult] = await Promise.all([
      apiFetch<{ items: TrackItem[] }>("/tracks"),
      apiFetch<{ items: KartTypeItem[] }>("/tracks/kart-types")
    ]);

    tracks.value = trackResult.items;
    kartTypes.value = kartTypeResult.items;

    if (isAdmin.value) {
      const pendingResult = await apiFetch<{ items: SubmissionItem[] }>(
        "/submissions/pending"
      );
      pendingSubmissions.value = pendingResult.items;
      return;
    }

    const myResult = await apiFetch<{ items: SubmissionItem[] }>("/submissions/mine");
    mySubmissions.value = myResult.items;
  } catch (error) {
    const message = error instanceof Error ? error.message : "页面加载失败";
    ElMessage.error(message);
  } finally {
    loading.value = false;
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  selectedFiles.value = input?.files ? Array.from(input.files) : [];
}

async function submitRecord() {
  submitting.value = true;

  try {
    const createResult = await apiFetch<{ success: boolean; item: SubmissionItem }>(
      "/submissions",
      {
        method: "POST",
        body: JSON.stringify({
          trackId: submissionForm.trackId,
          kartTypeId: submissionForm.kartTypeId,
          lapTimeText: submissionForm.lapTimeText,
          raceDate: submissionForm.raceDate,
          finalRanking: submissionForm.finalRanking,
          kartNo: submissionForm.kartNo,
          weather: submissionForm.weather,
          note: submissionForm.note
        })
      }
    );

    if (selectedFiles.value.length > 0) {
      const formData = new FormData();
      selectedFiles.value.forEach((file) => {
        formData.append("files", file);
      });

      await apiFetch(`/submissions/${createResult.item.id}/attachments`, {
        method: "POST",
        body: formData
      });
    }

    ElMessage.success("成绩申请已提交，等待管理员审核。");
    resetSubmissionForm();
    await loadPage();
  } catch (error) {
    const message = error instanceof Error ? error.message : "提交失败";
    ElMessage.error(message);
  } finally {
    submitting.value = false;
  }
}

async function approveSubmission(submissionId: string) {
  reviewingId.value = submissionId;

  try {
    await apiFetch<{ success: boolean }>(`/submissions/${submissionId}/approve`, {
      method: "POST",
      body: JSON.stringify({
        reviewNote: reviewNotes[submissionId] || ""
      })
    });

    ElMessage.success("成绩已审核通过，并写入正式榜单。");
    reviewNotes[submissionId] = "";
    await loadPage();
  } catch (error) {
    const message = error instanceof Error ? error.message : "审核通过失败";
    ElMessage.error(message);
  } finally {
    reviewingId.value = "";
  }
}

async function rejectSubmission(submissionId: string) {
  reviewingId.value = submissionId;

  try {
    await apiFetch<{ success: boolean }>(`/submissions/${submissionId}/reject`, {
      method: "POST",
      body: JSON.stringify({
        reviewNote: reviewNotes[submissionId] || ""
      })
    });

    ElMessage.success("该成绩申请已驳回。");
    reviewNotes[submissionId] = "";
    await loadPage();
  } catch (error) {
    const message = error instanceof Error ? error.message : "驳回失败";
    ElMessage.error(message);
  } finally {
    reviewingId.value = "";
  }
}

async function openAttachment(attachment: SubmissionAttachmentItem) {
  const storedAuth = readStoredAuth();
  const token = storedAuth?.accessToken;

  if (!token) {
    ElMessage.error("当前登录状态已失效，请重新登录。");
    return;
  }

  try {
    const response = await fetch(attachment.downloadPath, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "截图读取失败");
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => {
      window.URL.revokeObjectURL(objectUrl);
    }, 60_000);
  } catch (error) {
    const message = error instanceof Error ? error.message : "截图读取失败";
    ElMessage.error(message);
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

function resetSubmissionForm() {
  submissionForm.trackId = "";
  submissionForm.kartTypeId = "";
  submissionForm.lapTimeText = "";
  submissionForm.raceDate = new Date().toISOString().slice(0, 10);
  submissionForm.finalRanking = undefined;
  submissionForm.kartNo = "";
  submissionForm.weather = "";
  submissionForm.note = "";
  selectedFiles.value = [];
}

function formatSubmissionStatus(status: string) {
  switch (status) {
    case "PENDING":
      return "待审核";
    case "APPROVED":
      return "已通过";
    case "REJECTED":
      return "已驳回";
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
    default:
      return "warning";
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("zh-CN");
}
</script>

