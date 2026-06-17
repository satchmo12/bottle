export interface TelegramUser {
  id: number;
  username?: string;
  first_name: string;
}

export interface Bottle {
  id: number;
  user_id: number;
  content: string;
  created_at: number;
}