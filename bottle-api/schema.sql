-- 用户表
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_id TEXT UNIQUE,
  username TEXT,
  first_name TEXT,
  avatar TEXT,
  banned INTEGER DEFAULT 0,
  created_at INTEGER
);

-- 漂流瓶表
CREATE TABLE bottles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  content TEXT,
  created_at INTEGER,
  status TEXT DEFAULT 'active'
);

-- 捡到记录（防重复捞）
CREATE TABLE bottle_hits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  bottle_id INTEGER,
  created_at INTEGER,
  thread_status TEXT DEFAULT 'active',
  thread_closed_at INTEGER,
  thread_closed_by_user_id INTEGER
);

-- 私聊消息（每个捞到的人一条独立线程）
CREATE TABLE bottle_thread_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hit_id INTEGER NOT NULL,
  bottle_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 私聊已读状态
CREATE TABLE bottle_thread_read_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  hit_id INTEGER NOT NULL,
  last_read_message_id INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, hit_id)
);

CREATE TABLE bottle_thread_hidden_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  hit_id INTEGER NOT NULL,
  hidden_at INTEGER NOT NULL,
  UNIQUE(user_id, hit_id)
);

CREATE UNIQUE INDEX idx_bottle_hits_unique ON bottle_hits (user_id, bottle_id);
CREATE INDEX idx_bottle_hits_bottle_id ON bottle_hits (bottle_id);
CREATE INDEX idx_bottle_thread_messages_hit_id ON bottle_thread_messages (hit_id, id);
CREATE INDEX idx_bottle_thread_read_states_user_hit ON bottle_thread_read_states (user_id, hit_id);
CREATE INDEX idx_bottle_thread_hidden_states_user_hit ON bottle_thread_hidden_states (user_id, hit_id);
