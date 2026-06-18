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
  created_at INTEGER
);

-- 瓶子回复
CREATE TABLE bottle_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bottle_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
