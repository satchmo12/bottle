<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getMyBottles } from "../api";
import type { Bottle, TelegramUser } from "../types";

const props = defineProps<{
  user: TelegramUser;
}>();

const bottles = ref<Bottle[]>([]);
const isLoading = ref(false);
const errorMessage = ref("");

const loadBottles = async () => {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    bottles.value = await getMyBottles(props.user.id);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "读取我的瓶子失败。";
  } finally {
    isLoading.value = false;
  }
};

onMounted(loadBottles);
</script>

<template>
  <section class="panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">Inbox</p>
        <h2>我的瓶子与收到的回复</h2>
      </div>
      <button class="secondary-button" :disabled="isLoading" @click="loadBottles">
        {{ isLoading ? "刷新中..." : "刷新" }}
      </button>
    </div>

    <p v-if="errorMessage" class="feedback error">{{ errorMessage }}</p>
    <p v-else-if="!bottles.length" class="feedback neutral">
      你还没有扔过瓶子，先去写一句话吧。
    </p>

    <div v-else class="bottle-list">
      <article v-for="bottle in bottles" :key="bottle.id" class="bottle-card">
        <div class="bottle-meta">
          <span class="tag">瓶子 #{{ bottle.id }}</span>
          <span class="muted">{{ new Date(bottle.created_at).toLocaleString("zh-CN") }}</span>
        </div>

        <p class="bottle-content">{{ bottle.content }}</p>

        <div v-if="bottle.replies.length" class="reply-list">
          <div
            v-for="reply in bottle.replies"
            :key="reply.id"
            class="reply-card"
          >
            <div class="reply-meta">
              <strong>{{ reply.reply_user_name || "匿名捞瓶人" }}</strong>
              <span class="muted">{{ new Date(reply.created_at).toLocaleString("zh-CN") }}</span>
            </div>
            <p>{{ reply.content }}</p>
          </div>
        </div>

        <p v-else class="muted">这个瓶子还在海上漂着，暂时没有收到回复。</p>
      </article>
    </div>
  </section>
</template>
