import {legacyRedactionSql} from './legacy-redaction.js';
import type {Migration} from './migrations.js';
export const accountDeletionMigration:Migration={version:15,name:'account-deletion-redaction',sql:`
CREATE TABLE account_deletions(operation_id TEXT PRIMARY KEY NOT NULL,account_id TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL) STRICT;
CREATE TABLE account_deletion_receipts(session_hash TEXT PRIMARY KEY NOT NULL,operation_id TEXT NOT NULL REFERENCES account_deletions(operation_id),expires_at INTEGER NOT NULL) STRICT;
CREATE TABLE travel_run_redactions(run_id TEXT PRIMARY KEY NOT NULL REFERENCES travel_runs(id),summary_json TEXT NOT NULL CHECK(json_valid(summary_json))) STRICT;
${legacyRedactionSql}`};
