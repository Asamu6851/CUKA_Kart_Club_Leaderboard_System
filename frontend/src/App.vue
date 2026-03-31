<template>
  <main v-if="isAuthLayout" class="auth-layout">
    <router-view />
  </main>

  <div v-else class="shell">
    <header class="shell-header">
      <div class="shell-header-inner">
        <div class="shell-chrome-line" aria-hidden="true"></div>

        <div class="brand-lockup">
          <p class="eyebrow">CUKA在线圈速榜</p>

          <div class="brand-title-row">
            <h1>CUKA在线圈速榜</h1>
            <span class="role-pill">{{ roleLabel }}</span>
          </div>

          <div class="brand-subgrid">
            <span class="brand-chip">俱乐部管理中枢</span>
            <span class="brand-chip brand-chip-accent">正式成绩榜单</span>
          </div>

          <p class="support-text shell-copy">
            统一管理会员、赛道、圈速提交、截图审核和正式榜单，让俱乐部在同一套在线系统里稳定协作。
          </p>
        </div>

        <div class="header-actions">
          <div class="header-meta">
            <span class="meta-chip">{{ currentUserLabel }}</span>
          </div>
          <el-button v-if="authStore.isAuthenticated" type="primary" plain @click="handleLogout">
            退出登录
          </el-button>
          <el-button v-else type="primary" plain @click="handleLogin">登录</el-button>
        </div>
      </div>
    </header>

    <main class="shell-main">
      <section class="nav-shell">
        <el-menu
          :default-active="navActiveIndex"
          class="nav-card"
          mode="horizontal"
          router
        >
          <el-menu-item index="/dashboard">系统总览</el-menu-item>
          <el-menu-item index="/submissions">成绩提交与审核</el-menu-item>
          <el-menu-item index="/profile">车手卡</el-menu-item>
        </el-menu>

        <div class="nav-quickline">
          <span class="nav-indicator" aria-hidden="true"></span>
          <p class="nav-summary">{{ currentSectionLabel }}</p>
        </div>
      </section>

      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ElMessage } from "element-plus";
import { useRoute, useRouter } from "vue-router";

import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

authStore.initialize();

const isAuthLayout = computed(() => route.meta.layout === "auth");

const navActiveIndex = computed(() => {
  if (route.path.startsWith("/profile") || route.path.startsWith("/drivers/")) {
    return "/profile";
  }

  return route.path;
});

const currentUserLabel = computed(() => {
  if (!authStore.isAuthenticated) {
    return "游客访问";
  }

  return authStore.nickName || authStore.userName || "已登录用户";
});

const roleLabel = computed(() => {
  switch (authStore.role) {
    case "super_admin":
      return "超级管理员";
    case "admin":
      return "管理员";
    case "member":
      return "会员";
    default:
      return "公开访问";
  }
});

const currentSectionLabel = computed(() => {
  if (route.path === "/dashboard") {
    return "查看赛道、会员、正式成绩，以及按赛道和车型筛选后的圈速榜。";
  }

  if (route.path === "/submissions") {
    return "会员在这里提交圈速和截图，管理员在这里审核并录入正式榜单。";
  }

  if (route.path === "/profile") {
    return "维护自己的车手资料、公开照片，并查看全部个人提交与正式成绩。";
  }

  if (route.path.startsWith("/drivers/")) {
    return "公开车手详情页支持访问者查看照片和正式成绩。";
  }

  return "CUKA在线圈速榜";
});

async function handleLogout() {
  await authStore.logout();
  ElMessage.success("已退出登录。");
  await router.push("/login");
}

async function handleLogin() {
  await router.push({
    name: "login",
    query: {
      redirect: route.fullPath
    }
  });
}
</script>
