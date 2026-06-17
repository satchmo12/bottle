<script setup lang="ts">
import { ref } from "vue";
import { pickBottle } from "../api";
import type { Bottle, TelegramUser } from "../types";

const bottle = ref<Bottle | null>(null);

const pick = async () => {
  const tg = window.Telegram?.WebApp;
  const user = tg?.initDataUnsafe.user as TelegramUser;

  if (!user) return;

  bottle.value = await pickBottle(user.id);
};
</script>

<template>
  <div>
    <button @click="pick">捞一个瓶子</button>

    <div v-if="bottle">
      <p>内容：{{ bottle.content }}</p>
    </div>
  </div>
</template>