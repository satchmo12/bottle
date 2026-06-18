<script setup lang="ts">
import { computed, ref } from "vue";
import { sendBottle } from "../api";
import type { TelegramUser } from "../types";

const props = defineProps<{
  user: TelegramUser;
}>();

const content = ref("");
const message = ref("");
const errorMessage = ref("");
const isSubmitting = ref(false);

const remainingCount = computed(() => 200 - content.value.length);

const send = async () => {
  const text = content.value.trim();

  if (!text) {
    errorMessage.value = "先写一点心情，再把瓶子扔出去。";
    return;
  }

  if (text.length > 200) {
    errorMessage.value = "瓶子内容最多 200 个字。";
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = "";
  message.value = "";

  try {
    await sendBottle(props.user.id, text);
    content.value = "";
    message.value = "瓶子已经漂出去了，等人把它捞起来。";
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "扔瓶子失败，请稍后再试。";
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <section class="panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">Throw</p>
        <h2>扔一个新的漂流瓶</h2>
      </div>
      <p class="muted">写一段话，交给陌生人的海流。</p>
    </div>

    <label class="field">
      <span>瓶子内容</span>
      <textarea
        v-model="content"
        maxlength="200"
        placeholder="想说一句晚安、一个秘密，或者今天的好运。"
      />
    </label>

    <div class="composer-footer">
      <span :class="['hint', { danger: remainingCount < 0 }]">
        还可以写 {{ remainingCount }} 字
      </span>
      <button class="primary-button" :disabled="isSubmitting" @click="send">
        {{ isSubmitting ? "漂流中..." : "扔出去" }}
      </button>
    </div>

    <p v-if="message" class="feedback success">{{ message }}</p>
    <p v-if="errorMessage" class="feedback error">{{ errorMessage }}</p>
  </section>
</template>
