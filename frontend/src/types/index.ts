export interface TelegramUser {
  id: number;
  username?: string;
  first_name: string;
}

export interface BottleReply {
  id: number;
  bottle_id: number;
  user_id: number;
  content: string;
  created_at: number;
  reply_user_name?: string | null;
}

export interface Bottle {
  id: number;
  user_id: number;
  content: string;
  created_at: number;
  status: string;
  replies: BottleReply[];
}
