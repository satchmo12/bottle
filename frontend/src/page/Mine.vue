<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  deleteBottle,
  deleteBottleThread,
  getBottleThread,
  getMyThrownBottles,
  getPickedBottles,
  sendBottleMessage
} from "../api";
import type { Bottle, BottleThread, TelegramUser } from "../types";

type BottleGroup = "thrown" | "picked";

const props = defineProps<{
  user: TelegramUser;
}>();

const thrownBottles = ref<Bottle[]>([]);
const pickedBottles = ref<Bottle[]>([]);
const isLoading = ref(false);
const errorMessage = ref("");

const selectedGroup = ref<BottleGroup>("thrown");
const selectedEntryId = ref<string | null>(null);
const thread = ref<BottleThread | null>(null);
const isThreadLoading = ref(false);
const isLoadingOlder = ref(false);
const threadError = ref("");
const isCompact = ref(false);

const draft = ref("");
const draftError = ref("");
const isSending = ref(false);
const isDeleting = ref(false);
const isDeletingThread = ref<string | null>(null);

const thrownUnread = computed(() =>
  thrownBottles.value.reduce((sum, bottle) => sum + bottle.unread_count, 0)
);
const pickedUnread = computed(() =>
  pickedBottles.value.reduce((sum, bottle) => sum + bottle.unread_count, 0)
);

const selectedSummary = computed<Bottle | null>(() => {
  if (!selectedEntryId.value) return null;
  return findSummary(selectedGroup.value, selectedEntryId.value);
});

const showThreadPage = computed(
  () => isCompact.value && Boolean(selectedSummary.value)
);

const canSendMessage = computed(() => {
  if (!selectedSummary.value?.can_open_thread || !thread.value) {
    return false;
  }

  if (selectedGroup.value === "picked") {
    return true;
  }

  return thread.value.message_count > 0;
});

function getSummaryList(group: BottleGroup) {
  return group === "thrown" ? thrownBottles.value : pickedBottles.value;
}

function findSummary(group: BottleGroup, entryId: string) {
  return getSummaryList(group).find((item) => item.id === entryId) ?? null;
}

function syncSelection():
  | { group: BottleGroup; entryId: string }
  | null {
  if (selectedEntryId.value) {
    const currentSummary = findSummary(selectedGroup.value, selectedEntryId.value);

    if (currentSummary) {
      return {
        group: selectedGroup.value,
        entryId: currentSummary.id
      };
    }
  }

  selectedEntryId.value = null;
  thread.value = null;
  return null;
}

function replaceBottleSummary(nextBottle: Bottle) {
  thrownBottles.value = thrownBottles.value.map((item) =>
    item.id === nextBottle.id ? nextBottle : item
  );
  pickedBottles.value = pickedBottles.value.map((item) =>
    item.id === nextBottle.id ? nextBottle : item
  );
}

function mergeThreadSummary(nextThread: BottleThread) {
  replaceBottleSummary({
    id: nextThread.id,
    thread_id: nextThread.thread_id,
    bottle_id: nextThread.bottle_id,
    user_id: nextThread.user_id,
    content: nextThread.content,
    created_at: nextThread.created_at,
    status: nextThread.status,
    owner_name: nextThread.owner_name,
    picker_name: nextThread.picker_name,
    picked_at: nextThread.picked_at,
    picked_count: nextThread.picked_count,
    unread_count: nextThread.unread_count,
    message_count: nextThread.message_count,
    can_open_thread: nextThread.can_open_thread,
    latest_message: nextThread.latest_message
  });
}

function getEmptyText(group: BottleGroup) {
  return group === "thrown"
    ? "你还没有扔过瓶子，先去写一句话吧。"
    : "你还没有捞到瓶子，去海面看看今天会遇到谁。";
}

function getStatusText(bottle: Bottle, group: BottleGroup) {
  if (bottle.status === "deleted") {
    return group === "thrown" ? "已停止新捞取" : "已停止新捞取";
  }

  if (!bottle.can_open_thread) {
    return "漂流中";
  }

  if (bottle.message_count > 0) {
    return "私聊中";
  }

  return group === "thrown" ? "等待对方开口" : "等待你先开口";
}

function getAudienceText(bottle: Bottle, group: BottleGroup) {
  if (group === "thrown") {
    if (!bottle.can_open_thread) {
      return bottle.status === "deleted"
        ? "这个瓶子已经停止新捞取。"
        : "还没有人捞到它。";
    }

    const threadText = bottle.picker_name
      ? `与 ${bottle.picker_name} 的私聊`
      : "与一位陌生人的私聊";

    if (bottle.picked_count > 1) {
      return `${threadText}，同一个瓶子共有 ${bottle.picked_count} 位捞到者。`;
    }

    return threadText;
  }

  return bottle.owner_name
    ? `来自 ${bottle.owner_name} 的私聊`
    : "来自一位陌生人的私聊";
}

function getLatestPreview(bottle: Bottle) {
  if (bottle.latest_message) {
    const sender =
      bottle.latest_message.user_id === props.user.id
        ? "我"
        : bottle.latest_message.sender_name || "对方";
    return `${sender}：${bottle.latest_message.content}`;
  }

  if (!bottle.can_open_thread) {
    return "还没有人捞到这个瓶子";
  }

  return "还没有聊天记录";
}

function formatDate(value?: number | null) {
  if (!value) return "刚刚";
  return new Date(value).toLocaleString("zh-CN");
}

function updateViewportMode() {
  isCompact.value = window.innerWidth <= 860;
}

function goBackToList() {
  selectedEntryId.value = null;
  thread.value = null;
  threadError.value = "";
  draftError.value = "";
}

async function openSummary(group: BottleGroup, summary: Bottle) {
  const sameSummary = selectedEntryId.value === summary.id;

  selectedGroup.value = group;
  selectedEntryId.value = summary.id;
  threadError.value = "";
  draftError.value = "";

  if (!sameSummary) {
    draft.value = "";
  }

  if (!summary.thread_id) {
    thread.value = null;
    return;
  }

  isThreadLoading.value = true;

  try {
    const nextThread = await getBottleThread(props.user.id, summary.thread_id);
    thread.value = nextThread;
    mergeThreadSummary(nextThread);
  } catch (error) {
    thread.value = null;
    threadError.value =
      error instanceof Error ? error.message : "读取会话失败，请稍后再试。";
  } finally {
    isThreadLoading.value = false;
  }
}

async function loadOlderMessages() {
  if (!thread.value?.has_more || !thread.value.next_before_id) return;

  isLoadingOlder.value = true;
  threadError.value = "";

  try {
    const olderThread = await getBottleThread(props.user.id, thread.value.thread_id, {
      beforeId: thread.value.next_before_id
    });

    thread.value = {
      ...thread.value,
      ...olderThread,
      messages: [...olderThread.messages, ...thread.value.messages]
    };
  } catch (error) {
    threadError.value =
      error instanceof Error ? error.message : "加载更早消息失败，请稍后再试。";
  } finally {
    isLoadingOlder.value = false;
  }
}

async function loadBottles(options?: {
  refreshThread?: boolean;
  resetSelection?: boolean;
}) {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    const [thrown, picked] = await Promise.all([
      getMyThrownBottles(props.user.id),
      getPickedBottles(props.user.id)
    ]);

    thrownBottles.value = thrown;
    pickedBottles.value = picked;

    if (options?.resetSelection) {
      selectedEntryId.value = null;
      thread.value = null;
    }

    const target = syncSelection();

    if (!target) {
      thread.value = null;
      return;
    }

    const summary = findSummary(target.group, target.entryId);

    if (!summary) {
      thread.value = null;
      return;
    }

    if (!summary.thread_id) {
      thread.value = null;
      return;
    }

    if (
      options?.refreshThread ||
      !thread.value ||
      thread.value.thread_id !== summary.thread_id
    ) {
      await openSummary(target.group, summary);
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "读取聊天盒失败。";
  } finally {
    isLoading.value = false;
  }
}

async function sendMessage() {
  const currentThread = thread.value;

  if (!currentThread?.thread_id) {
    draftError.value = "先选中一条私聊，再继续聊天。";
    return;
  }

  const text = draft.value.trim();

  if (!text) {
    draftError.value = "消息不能为空。";
    return;
  }

  if (!canSendMessage.value) {
    draftError.value = "先等待对方发来第一条消息。";
    return;
  }

  isSending.value = true;
  draftError.value = "";

  try {
    await sendBottleMessage(currentThread.thread_id, props.user.id, text);
    draft.value = "";
    await loadBottles({ refreshThread: true });
  } catch (error) {
    draftError.value =
      error instanceof Error ? error.message : "发送消息失败，请稍后再试。";
  } finally {
    isSending.value = false;
  }
}

async function removeBottle() {
  if (!selectedSummary.value) return;

  const bottleId = selectedSummary.value.bottle_id;
  isDeleting.value = true;
  threadError.value = "";
  errorMessage.value = "";

  try {
    await deleteBottle(bottleId, props.user.id);

    thrownBottles.value = thrownBottles.value.filter(
      (item) => item.bottle_id !== bottleId
    );

    if (selectedSummary.value?.bottle_id === bottleId) {
      goBackToList();
    }

    await loadBottles();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "删除瓶子失败，请稍后再试。";
    threadError.value = message;
    errorMessage.value = message;
  } finally {
    isDeleting.value = false;
  }
}

async function removeBottleFromList(summary: Bottle) {
  selectedGroup.value = "thrown";
  selectedEntryId.value = summary.id;
  await removeBottle();
}

async function removeThread(group: BottleGroup, summary: Bottle) {
  if (!summary.thread_id) {
    return;
  }

  isDeletingThread.value = summary.id;
  threadError.value = "";
  errorMessage.value = "";

  try {
    await deleteBottleThread(summary.thread_id, props.user.id);

    if (selectedEntryId.value === summary.id) {
      goBackToList();
    }

    if (group === "thrown") {
      thrownBottles.value = thrownBottles.value.filter((item) => item.id !== summary.id);
    } else {
      pickedBottles.value = pickedBottles.value.filter((item) => item.id !== summary.id);
    }

    await loadBottles();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "删除会话失败，请稍后再试。";
    threadError.value = message;
    errorMessage.value = message;
  } finally {
    isDeletingThread.value = null;
  }
}

onMounted(() => {
  updateViewportMode();
  window.addEventListener("resize", updateViewportMode);
  loadBottles({ resetSelection: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateViewportMode);
});
</script>

<template>
  <section class="panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">Chatbox</p>
        <h2>聊天盒</h2>
      </div>
      <button class="secondary-button" :disabled="isLoading" @click="loadBottles({ refreshThread: true })">
        {{ isLoading ? "刷新中..." : "刷新会话" }}
      </button>
    </div>

    <p v-if="errorMessage" class="feedback error">{{ errorMessage }}</p>

    <div :class="['conversation-grid', { 'thread-page': showThreadPage }]">
      <aside v-if="!showThreadPage" class="conversation-list-stack">
        <section class="conversation-column">
          <div class="column-header">
            <div class="summary-heading">
              <h3>我扔的瓶子</h3>
              <span class="tag">{{ thrownBottles.length }}</span>
            </div>
            <span v-if="thrownUnread" class="unread-pill">{{ thrownUnread }} 未读</span>
          </div>

          <p v-if="!thrownBottles.length" class="feedback neutral">
            {{ getEmptyText("thrown") }}
          </p>

          <div v-else class="summary-list">
            <article
              v-for="bottle in thrownBottles"
              :key="bottle.id"
              :class="['summary-card', { active: selectedGroup === 'thrown' && selectedEntryId === bottle.id }]"
            >
              <button class="summary-main" @click="openSummary('thrown', bottle)">
                <div class="summary-header">
                  <span class="tag">瓶子 #{{ bottle.bottle_id }}</span>
                  <span class="status-chip">{{ getStatusText(bottle, "thrown") }}</span>
                </div>

                <p class="summary-content">{{ bottle.content }}</p>
                <p class="summary-preview">{{ getLatestPreview(bottle) }}</p>

                <div class="summary-footer">
                  <span class="muted">{{ getAudienceText(bottle, "thrown") }}</span>
                  <span class="muted">
                    {{ formatDate(bottle.latest_message?.created_at || bottle.picked_at || bottle.created_at) }}
                  </span>
                </div>

                <span v-if="bottle.unread_count > 0" class="summary-unread">
                  {{ bottle.unread_count }}
                </span>
              </button>

              <div class="summary-actions">
                <button
                  v-if="bottle.thread_id"
                  class="summary-delete"
                  :disabled="isDeletingThread === bottle.id"
                  @click="removeThread('thrown', bottle)"
                >
                  {{ isDeletingThread === bottle.id ? "删除中..." : "删除会话" }}
                </button>

                <button
                  class="summary-delete bottle-delete"
                  :disabled="isDeleting"
                  @click="removeBottleFromList(bottle)"
                >
                  {{ isDeleting ? "删除中..." : "删除瓶子" }}
                </button>
              </div>
            </article>
          </div>
        </section>

        <section class="conversation-column">
          <div class="column-header">
            <div class="summary-heading">
              <h3>我捞到的瓶子</h3>
              <span class="tag">{{ pickedBottles.length }}</span>
            </div>
            <span v-if="pickedUnread" class="unread-pill">{{ pickedUnread }} 未读</span>
          </div>

          <p v-if="!pickedBottles.length" class="feedback neutral">
            {{ getEmptyText("picked") }}
          </p>

          <div v-else class="summary-list">
            <article
              v-for="bottle in pickedBottles"
              :key="bottle.id"
              :class="['summary-card', { active: selectedGroup === 'picked' && selectedEntryId === bottle.id }]"
            >
              <button class="summary-main" @click="openSummary('picked', bottle)">
                <div class="summary-header">
                  <span class="tag">瓶子 #{{ bottle.bottle_id }}</span>
                  <span class="status-chip">{{ getStatusText(bottle, "picked") }}</span>
                </div>

                <p class="summary-content">{{ bottle.content }}</p>
                <p class="summary-preview">{{ getLatestPreview(bottle) }}</p>

                <div class="summary-footer">
                  <span class="muted">{{ getAudienceText(bottle, "picked") }}</span>
                  <span class="muted">
                    {{ formatDate(bottle.latest_message?.created_at || bottle.picked_at || bottle.created_at) }}
                  </span>
                </div>

                <span v-if="bottle.unread_count > 0" class="summary-unread">
                  {{ bottle.unread_count }}
                </span>
              </button>

              <button
                v-if="bottle.thread_id"
                class="summary-delete"
                :disabled="isDeletingThread === bottle.id"
                @click="removeThread('picked', bottle)"
              >
                {{ isDeletingThread === bottle.id ? "删除中..." : "删除会话" }}
              </button>
            </article>
          </div>
        </section>
      </aside>

      <section v-if="!isCompact || selectedSummary" class="thread-panel">
        <div v-if="selectedSummary" class="thread-shell">
          <div class="thread-toolbar">
            <button
              v-if="showThreadPage"
              class="secondary-button back-button"
              @click="goBackToList"
            >
              返回消息列表
            </button>
          </div>

          <div class="thread-header">
            <div>
              <div class="bottle-meta">
                <span class="tag">瓶子 #{{ selectedSummary.bottle_id }}</span>
                <span class="status-chip">{{ getStatusText(selectedSummary, selectedGroup) }}</span>
              </div>
              <h3 class="thread-title">{{ selectedSummary.content }}</h3>
              <p class="muted">
                {{ getAudienceText(selectedSummary, selectedGroup) }}
              </p>
            </div>

            <div class="thread-actions">
              <button
                v-if="selectedSummary.thread_id"
                class="ghost-button"
                :disabled="isDeletingThread === selectedSummary.id"
                @click="removeThread(selectedGroup, selectedSummary)"
              >
                {{ isDeletingThread === selectedSummary.id ? "删除中..." : "删除会话" }}
              </button>

              <button
                v-if="selectedGroup === 'thrown'"
                class="ghost-button"
                :disabled="isDeleting || selectedSummary.status === 'deleted'"
                @click="removeBottle"
              >
                {{ selectedSummary.status === "deleted" ? "已删除瓶子" : (isDeleting ? "处理中..." : "删除瓶子") }}
              </button>
            </div>
          </div>

          <p v-if="threadError" class="feedback error">{{ threadError }}</p>

          <div class="thread-stream">
            <button
              v-if="thread?.has_more"
              class="secondary-button load-more-button"
              :disabled="isLoadingOlder"
              @click="loadOlderMessages"
            >
              {{ isLoadingOlder ? "加载中..." : "加载更早消息" }}
            </button>

            <div v-if="isThreadLoading" class="feedback neutral">
              正在读取私聊...
            </div>

            <div v-else-if="thread?.messages.length" class="reply-list">
              <div
                v-for="message in thread.messages"
                :key="message.id"
                :class="['message-bubble', { self: message.user_id === user.id }]"
              >
                <div class="reply-meta">
                  <strong>
                    {{ message.user_id === user.id ? "我" : message.sender_name || "对方" }}
                  </strong>
                  <span class="muted">{{ formatDate(message.created_at) }}</span>
                </div>
                <p>{{ message.content }}</p>
              </div>
            </div>

            <p v-else-if="selectedSummary.can_open_thread" class="muted chat-hint">
              {{
                selectedGroup === "thrown"
                  ? "对方还没发来第一条消息，等他先开口后你就可以回复。"
                  : "这是你们的第一句话，从这里开始吧。"
              }}
            </p>

            <p v-else class="muted chat-hint">
              还没有人捞到这个瓶子，所以暂时没有私聊内容。
            </p>
          </div>

          <div v-if="selectedSummary.can_open_thread" class="thread-composer">
            <textarea
              v-model="draft"
              rows="4"
              maxlength="200"
              :placeholder="selectedGroup === 'picked' ? '写下你想继续说的话...' : '继续回一句...'"
            />
            <div class="composer-footer">
              <span class="hint">
                {{
                  canSendMessage
                    ? "消息只会发到这条私聊里，并提醒这条私聊的另一方。"
                    : "等对方先发来第一句话后，你就可以继续回复。"
                }}
              </span>
              <button
                class="primary-button"
                :disabled="isSending || !thread"
                @click="sendMessage"
              >
                {{ isSending ? "发送中..." : "发送消息" }}
              </button>
            </div>
            <p v-if="draftError" class="feedback error compact">
              {{ draftError }}
            </p>
          </div>
        </div>

        <div v-else class="panel-placeholder">
          <p class="eyebrow">Thread</p>
          <h3>先选一条摘要</h3>
          <p class="muted">左边会显示你扔出的瓶子和你捞到的私聊摘要，点开后就能看完整会话。</p>
        </div>
      </section>
    </div>
  </section>
</template>
