export interface TelegramUser {
  id: number;
  username?: string;
  first_name: string;
}

export interface BottleMessage {
  id: number;
  thread_id: number;
  bottle_id: number;
  user_id: number;
  content: string;
  created_at: number;
  sender_name?: string | null;
}

export interface Bottle {
  id: string;
  thread_id: number | null;
  bottle_id: number;
  user_id: number;
  content: string;
  created_at: number;
  status: string;
  owner_name?: string | null;
  picker_name?: string | null;
  picked_at?: number | null;
  picked_count: number;
  unread_count: number;
  message_count: number;
  can_open_thread: boolean;
  latest_message: BottleMessage | null;
}

export interface BottleThread extends Bottle {
  thread_id: number;
  can_open_thread: true;
  messages: BottleMessage[];
  has_more: boolean;
  next_before_id: number | null;
}
