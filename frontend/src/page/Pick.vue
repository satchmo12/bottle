<script setup lang="ts">
import { ref } from "vue";
import { pickBottle, sendBottleMessage } from "../api";
import type { Bottle, TelegramUser } from "../types";

const props = defineProps<{
  user: TelegramUser;
}>();

const bottle = ref<Bottle | null>(null);
const replyContent = ref("");
const message = ref("点一下按钮，看看海面会漂来什么。");
const errorMessage = ref("");
const isPicking = ref(false);
const isReplying = ref(false);

const pick = async () => {
  isPicking.value = true;
  errorMessage.value = "";
  message.value = "";
  replyContent.value = "";

  try {
    const result = await pickBottle(props.user.id);

    if (!result) {
      bottle.value = null;
      message.value = "现在海面有点安静，稍后再来捞一个吧。";
      return;
    }

    bottle.value = result;
    message.value = "捞到了一个瓶子。你可以先回一句，也可以稍后去“聊天盒”继续聊。";
  } catch (error) {
    bottle.value = null;
    errorMessage.value =
      error instanceof Error ? error.message : "捞瓶子失败，请稍后重试。";
  } finally {
    isPicking.value = false;
  }
};

const submitReply = async () => {
  if (!bottle.value) {
    errorMessage.value = "先捞到一个瓶子，再写回复。";
    return;
  }

  const text = replyContent.value.trim();

  if (!text) {
    errorMessage.value = "回复不能为空。";
    return;
  }

  isReplying.value = true;
  errorMessage.value = "";

  try {
    if (!bottle.value.thread_id) {
      throw new Error("没有可用的私聊线程。");
    }

    await sendBottleMessage(bottle.value.thread_id, props.user.id, text);
    replyContent.value = "";
    bottle.value = null;
    message.value = "第一条消息已经送回去了，去“聊天盒”里继续对话吧。";
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "回复失败，请稍后再试。";
  } finally {
    isReplying.value = false;
  }
};
</script>

<template>
  <section class="panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">Pick</p>
        <h2>捞一个陌生人的瓶子</h2>
      </div>
      <button class="secondary-button" :disabled="isPicking" @click="pick">
        {{ isPicking ? "打捞中..." : "捞一个瓶子" }}
      </button>
    </div>

    <p class="feedback neutral">{{ message }}</p>
    <p v-if="errorMessage" class="feedback error">{{ errorMessage }}</p>

    <div v-if="bottle" class="bottle-card featured">
      <div class="bottle-meta">
        <span class="tag">漂流瓶 #{{ bottle.bottle_id }}</span>
        <span class="muted">{{ new Date(bottle.created_at).toLocaleString("zh-CN") }}</span>
      </div>
      <p class="bottle-content">{{ bottle.content }}</p>

      <label class="field">
        <span>发出第一条消息</span>
        <textarea
          v-model="replyContent"
          maxlength="160"
          placeholder="这会成为你们聊天的第一句话。"
        />
      </label>

      <div class="composer-footer">
        <span class="hint">发送后，它会出现在“聊天盒”的我捞到的瓶子里。</span>
        <button
          class="primary-button"
          :disabled="isReplying"
          @click="submitReply"
        >
          {{ isReplying ? "发送中..." : "发送消息" }}
        </button>
      </div>
    </div>
  </section>
</template>
