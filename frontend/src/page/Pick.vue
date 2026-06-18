<script setup lang="ts">
import { ref } from "vue";
import { pickBottle } from "../api";
import type { Bottle } from "../types";
import { getTelegramUser } from "../utils/telegram";

const bottle = ref<Bottle | null>(null);

const pick = async () => {
  const user = getTelegramUser();
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
