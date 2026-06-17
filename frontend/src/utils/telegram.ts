export function getTelegram() {
  return window.Telegram?.WebApp
}

export function initTelegram() {
  const tg = getTelegram()
  if (!tg) return null

  tg.ready()
  tg.expand()

  return tg
}