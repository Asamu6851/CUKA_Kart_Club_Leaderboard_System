<template>
  <div class="auth-stage">
    <section class="panel-card form-card auth-portal">
      <div class="auth-portal-intro">
        <h1 class="auth-title">CUKA线上圈速榜</h1>
      </div>

      <section class="auth-panels">
        <section class="panel-card form-card auth-panel">
          <div class="section-intro">
            <h2>登录</h2>
          </div>

          <el-form label-position="top" @submit.prevent="submitLogin">
            <el-form-item label="用户名">
              <el-input v-model="loginForm.username" placeholder="请输入用户名" />
            </el-form-item>

            <el-form-item label="密码">
              <el-input
                v-model="loginForm.password"
                placeholder="请输入密码"
                show-password
                type="password"
              />
            </el-form-item>

            <div class="form-actions">
              <el-button :loading="loginSubmitting" type="primary" @click="submitLogin">
                登录
              </el-button>
            </div>
          </el-form>
        </section>

        <section class="panel-card form-card auth-panel">
          <div class="section-intro">
            <h2>注册</h2>
          </div>

          <el-form label-position="top" @submit.prevent="submitRegister">
            <el-form-item label="登录用户名">
              <el-input
                v-model="registerForm.username"
                placeholder="支持字母、数字、下划线、点号、短横线"
              />
            </el-form-item>

            <el-form-item label="微信 / 抖音 群昵称">
              <el-input
                v-model="registerForm.nickname"
                placeholder="用于管理员审核和榜单展示"
              />
            </el-form-item>

            <el-form-item label="登录密码">
              <el-input
                v-model="registerForm.password"
                placeholder="至少 6 位"
                show-password
                type="password"
              />
            </el-form-item>

            <div class="form-actions">
              <el-button
                :loading="registerSubmitting"
                type="success"
                @click="submitRegister"
              >
                提交注册申请
              </el-button>
            </div>
          </el-form>
        </section>
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRoute, useRouter } from "vue-router";

import { apiFetch } from "@/lib/http";
import { useAuthStore } from "@/stores/auth";

interface RegisterResponse {
  success: boolean;
  message: string;
}

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const loginForm = reactive({
  username: "",
  password: ""
});

const registerForm = reactive({
  username: "",
  nickname: "",
  password: ""
});

const loginSubmitting = ref(false);
const registerSubmitting = ref(false);

authStore.initialize();

const redirectPath = computed(() => {
  return typeof route.query.redirect === "string" ? route.query.redirect : "/dashboard";
});

async function submitLogin() {
  loginSubmitting.value = true;

  try {
    await authStore.login({
      username: loginForm.username,
      password: loginForm.password
    });
    ElMessage.success("登录成功，正在进入系统。");
    await router.push(redirectPath.value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录失败";
    ElMessage.error(message);
  } finally {
    loginSubmitting.value = false;
  }
}

async function submitRegister() {
  registerSubmitting.value = true;

  try {
    const result = await apiFetch<RegisterResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(registerForm)
    });

    ElMessage.success(result.message || "注册申请已提交。");
    registerForm.username = "";
    registerForm.nickname = "";
    registerForm.password = "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "注册失败";
    ElMessage.error(message);
  } finally {
    registerSubmitting.value = false;
  }
}
</script>
