<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { TelegramUser } from "./types";
import { tgLogin } from "./api";
import { getTelegramUser } from "./utils/telegram";

const user = ref<TelegramUser | null>(null);

onMounted(async () => {
  const tgUser = getTelegramUser();
  if (!tgUser) return;

  user.value = tgUser;

  await tgLogin(tgUser);
});
</script>

<template>
  <div>
    <h2>漂流瓶</h2>
    <p v-if="user">欢迎 {{ user.first_name }}</p>
    <p v-else>未读取到 Telegram 用户信息</p>
  </div>
</template>
