<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { TelegramUser } from "./types";
import { tgLogin } from "./api";

const user = ref<TelegramUser | null>(null);

onMounted(async () => {
  const tg = window.Telegram?.WebApp;

  if (!tg) return;

  const tgUser = tg.initDataUnsafe.user as TelegramUser;

  user.value = tgUser;

  await tgLogin(tgUser);
});
</script>

<template>
  <div>
    <h2>漂流瓶</h2>
    <p v-if="user">欢迎 {{ user.first_name }}</p>
  </div>
</template>