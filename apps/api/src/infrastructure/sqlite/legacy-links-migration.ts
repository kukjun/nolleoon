import type {Migration} from './migrations.js';
export const legacyLinksMigration:Migration={version:13,name:'explicit-account-legacy-links',sql:`
CREATE TABLE account_legacy_links(id TEXT PRIMARY KEY NOT NULL,account_id TEXT NOT NULL REFERENCES accounts(id),run_id TEXT NOT NULL REFERENCES game_runs(id),legacy_session_id TEXT NOT NULL REFERENCES sessions(id),linked_at INTEGER NOT NULL,UNIQUE(run_id,legacy_session_id)) STRICT;
CREATE INDEX account_legacy_history ON account_legacy_links(account_id,linked_at,id);
CREATE TRIGGER account_legacy_link_immutable BEFORE UPDATE ON account_legacy_links BEGIN SELECT RAISE(ABORT,'immutable legacy proof'); END;
`};
