import type {Migration} from './migrations.js';
export const unlinkRequirementMigration:Migration={version:18,name:'required-unlink-queue-authority',sql:`CREATE TABLE unlink_queue_requirement(id INTEGER PRIMARY KEY CHECK(id=1),binding_hash TEXT NOT NULL,known_sequence INTEGER NOT NULL CHECK(known_sequence>=0),known_digest TEXT NOT NULL) STRICT;`};
