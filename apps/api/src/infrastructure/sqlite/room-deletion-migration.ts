import type {Migration} from './migrations.js';
export const roomDeletionMigration:Migration={version:16,name:'travel-room-deletion-grace',sql:`
CREATE TABLE travel_room_deletion_events(operation_id TEXT PRIMARY KEY NOT NULL) STRICT;
CREATE TABLE travel_room_deletions (
 room_id TEXT PRIMARY KEY NOT NULL REFERENCES travel_rooms(id),
 deletion_version INTEGER NOT NULL CHECK(deletion_version>=1),
 deleted_at INTEGER NOT NULL CHECK(deleted_at>=0),
 purge_after INTEGER NOT NULL CHECK(purge_after=deleted_at+604800000),
 previous_status TEXT NOT NULL CHECK(previous_status IN ('open','closed')),
 administrator_account_id TEXT NOT NULL REFERENCES accounts(id)
) STRICT;
`};
