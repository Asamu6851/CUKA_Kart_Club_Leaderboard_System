import { createRouter, createWebHistory } from "vue-router";

import { readStoredAuth } from "@/lib/auth-storage";

const LoginView = () => import("@/views/LoginView.vue");
const DashboardView = () => import("@/views/DashboardView.vue");
const SubmissionsView = () => import("@/views/SubmissionsView.vue");
const MemberProfileView = () => import("@/views/MemberProfileView.vue");

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: "/dashboard"
    },
    {
      path: "/login",
      name: "login",
      component: LoginView,
      meta: {
        layout: "auth",
        guestOnly: true
      }
    },
    {
      path: "/dashboard",
      name: "dashboard",
      component: DashboardView,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: "/submissions",
      name: "submissions",
      component: SubmissionsView,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: "/profile",
      name: "profile",
      component: MemberProfileView,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: "/drivers/:memberId",
      name: "driver-profile",
      component: MemberProfileView,
      meta: {
        publicProfile: true
      }
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: "/dashboard"
    }
  ]
});

router.beforeEach((to) => {
  const storedAuth = readStoredAuth();
  const isAuthenticated = Boolean(storedAuth?.accessToken);

  if (to.meta.requiresAuth && !isAuthenticated) {
    return {
      name: "login",
      query: {
        redirect: to.fullPath
      }
    };
  }

  if (to.meta.guestOnly && isAuthenticated) {
    return {
      path: "/dashboard"
    };
  }

  return true;
});

export default router;
