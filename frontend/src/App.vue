<script setup lang="ts">
import { onMounted, ref } from "vue";
import { tgLogin } from "./api";
import Send from "./page/Send.vue";
import Pick from "./page/Pick.vue";
import Mine from "./page/Mine.vue";
import type { TelegramUser } from "./types";
import { getTelegramUser } from "./utils/telegram";

type TabKey = "send" | "pick" | "mine";

const user = ref<TelegramUser | null>(null);
const activeTab = ref<TabKey>("send");
const errorMessage = ref("");

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "send", label: "扔瓶子", icon: "投" },
  { key: "pick", label: "捞瓶子", icon: "捞" },
  { key: "mine", label: "消息盒", icon: "聊" }
];

onMounted(async () => {
  const tgUser = getTelegramUser();

  if (!tgUser) {
    errorMessage.value = "没有读取到 Telegram 用户信息，请从 Telegram 里重新打开。";
    return;
  }

  user.value = tgUser;

  try {
    await tgLogin(tgUser);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "登录失败，请稍后再试。";
  }
});
</script>

<template>
  <main class="shell">
    <section class="hero-card">
      <p class="eyebrow">Bottle</p>
      <h1>漂流瓶</h1>
      <p class="hero-copy">
        在 Telegram 里写下一句话，把它交给陌生人；再从海上捞起别人的心情，回一封短短的回信。
      </p>

      <!-- <div v-if="user" class="hero-user">
        <span class="avatar">{{ user.first_name.slice(0, 1) }}</span>
        <div>
          <strong>{{ user.first_name }}</strong>
          <p class="muted">@{{ user.username || `user_${user.id}` }}</p>
        </div>
      </div> -->

      <p v-if="errorMessage" class="feedback error">{{ errorMessage }}</p>
    </section>

    <section v-if="user" class="app-grid">
      <div class="content-stage">
        <Send v-if="activeTab === 'send'" :user="user" />
        <Pick v-else-if="activeTab === 'pick'" :user="user" />
        <Mine v-else :user="user" />
      </div>
    </section>

    <nav v-if="user" class="bottom-tabbar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['bottom-tab', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        <span class="bottom-tab-icon">{{ tab.icon }}</span>
        <span class="bottom-tab-label">{{ tab.label }}</span>
      </button>
    </nav>
  </main>
</template>
