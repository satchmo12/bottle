
<template>
  <div>
    <h2>漂流瓶</h2>
    <textarea v-model="content" />
    <button @click="throwBottle">扔瓶子</button>
    <button @click="pickBottle">捞瓶子</button>

    <div v-if="picked">
      <h3>捞到的瓶子</h3>
      <p>{{ picked.content }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const content = ref('')
const picked = ref(null)

async function throwBottle() {
  await fetch('/bottle/throw', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      userId: 'demo-user',
      content: content.value
    })
  })
}

async function pickBottle() {
  const res = await fetch('/bottle/pick', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ userId: 'demo-user' })
  })
  picked.value = await res.json()
}
</script>
