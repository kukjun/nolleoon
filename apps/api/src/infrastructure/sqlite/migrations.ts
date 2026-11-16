export interface Migration { version: number; name: string; sql: string }
export const migrations: readonly Migration[] = [{version:1,name:'storage-foundation',sql:`
CREATE TABLE sessions (
 id TEXT PRIMARY KEY NOT NULL, token_hash TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL CHECK(created_at >= 0), expires_at INTEGER NOT NULL CHECK(expires_at > created_at)
) STRICT;
CREATE TABLE rooms (
 id TEXT PRIMARY KEY NOT NULL, invite_code TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL CHECK(status IN ('open','closed')), version INTEGER NOT NULL CHECK(version >= 0),
 created_at INTEGER NOT NULL CHECK(created_at >= 0), host_member_id TEXT,
 FOREIGN KEY(id,host_member_id) REFERENCES room_members(room_id,id)
) STRICT;
CREATE TABLE room_members (
 id TEXT PRIMARY KEY NOT NULL, room_id TEXT NOT NULL REFERENCES rooms(id), session_id TEXT NOT NULL REFERENCES sessions(id),
 nickname TEXT NOT NULL, nickname_key TEXT NOT NULL, joined_at INTEGER NOT NULL CHECK(joined_at >= 0),
 disconnected_at INTEGER, left_at INTEGER, UNIQUE(room_id,id)
) STRICT;
CREATE UNIQUE INDEX active_member_session ON room_members(room_id,session_id) WHERE left_at IS NULL;
CREATE UNIQUE INDEX active_member_nickname ON room_members(room_id,nickname_key) WHERE left_at IS NULL;
CREATE TABLE games (
 id TEXT PRIMARY KEY NOT NULL, room_id TEXT NOT NULL REFERENCES rooms(id),
 status TEXT NOT NULL CHECK(status IN ('draft','defense','voting','final-defense','result','interrupted')),
 case_text TEXT NOT NULL, penalty_text TEXT NOT NULL, duration_seconds INTEGER NOT NULL CHECK(duration_seconds BETWEEN 60 AND 600 AND duration_seconds % 60 = 0),
 version INTEGER NOT NULL CHECK(version >= 0), created_at INTEGER NOT NULL CHECK(created_at >= 0), UNIQUE(id,room_id)
) STRICT;
CREATE UNIQUE INDEX one_active_game ON games(room_id) WHERE status NOT IN ('result','interrupted');
CREATE TABLE game_participants (
 game_id TEXT NOT NULL, room_id TEXT NOT NULL, member_id TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('defendant','participant','observer')),
 eligible INTEGER NOT NULL CHECK(eligible IN (0,1) AND (role = 'participant' OR eligible = 0)),
 PRIMARY KEY(game_id,member_id), FOREIGN KEY(game_id,room_id) REFERENCES games(id,room_id),
 FOREIGN KEY(room_id,member_id) REFERENCES room_members(room_id,id)
) STRICT;
CREATE UNIQUE INDEX one_defendant ON game_participants(game_id) WHERE role='defendant';
CREATE TABLE rounds (
 game_id TEXT NOT NULL REFERENCES games(id), number INTEGER NOT NULL CHECK(number IN (1,2)),
 started_at INTEGER NOT NULL CHECK(started_at >= 0), deadline INTEGER NOT NULL CHECK(deadline > started_at), closed_at INTEGER,
 PRIMARY KEY(game_id,number)
) STRICT;
CREATE TABLE votes (
 game_id TEXT NOT NULL, round_number INTEGER NOT NULL, member_id TEXT NOT NULL,
 choice TEXT NOT NULL CHECK(choice IN ('guilty','not-guilty','abstain')), reason TEXT NOT NULL,
 request_id TEXT NOT NULL, submitted_at INTEGER NOT NULL CHECK(submitted_at >= 0),
 PRIMARY KEY(game_id,round_number,member_id), UNIQUE(game_id,round_number,request_id),
 FOREIGN KEY(game_id,round_number) REFERENCES rounds(game_id,number),
 FOREIGN KEY(game_id,member_id) REFERENCES game_participants(game_id,member_id)
) STRICT;
CREATE TABLE drafts (
 room_id TEXT PRIMARY KEY NOT NULL REFERENCES rooms(id), case_text TEXT NOT NULL, penalty_text TEXT NOT NULL,
 duration_seconds INTEGER NOT NULL CHECK(duration_seconds BETWEEN 60 AND 600 AND duration_seconds % 60 = 0),
 version INTEGER NOT NULL CHECK(version >= 0)
) STRICT;
`},{version:2,name:'member-presence',sql:`
ALTER TABLE room_members ADD COLUMN last_seen_at INTEGER;
UPDATE room_members SET last_seen_at=joined_at;
CREATE INDEX member_presence_sweep ON room_members(last_seen_at) WHERE left_at IS NULL AND disconnected_at IS NULL;
`}];
