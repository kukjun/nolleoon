import type {Migration} from './migrations.js';
export const nativeSessionMigration:Migration={version:19,name:'separate-native-account-sessions',sql:`
CREATE TABLE native_account_sessions(token_hash TEXT PRIMARY KEY NOT NULL,account_id TEXT NOT NULL REFERENCES accounts(id),created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL CHECK(expires_at>created_at),revoked_at INTEGER) STRICT;
CREATE INDEX native_account_sessions_account ON native_account_sessions(account_id);
`};
