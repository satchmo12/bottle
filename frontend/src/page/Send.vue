<script setup lang="ts">
import { ref } from "vue";
import { sendBottle } from "../api";
import { getTelegramUser } from "../utils/telegram";

const content = ref("");

const send = async () => {
  const user = getTelegramUser();
  if (!user) return;

  await sendBottle(user.id, content.value);

  alert("扔成功");
  content.value = "";
};
</script>

<template>
  <div>
    <textarea v-model="content" placeholder="写下漂流瓶..." />
    <button @click="send">扔出去</button>
  </div>
</template>
