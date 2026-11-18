import type {Migration} from './migrations.js';
export const nativeDeletionReceiptMigration:Migration={version:20,name:'transport-isolated-native-deletion-receipts',sql:`
CREATE TABLE native_account_deletion_receipts(session_hash TEXT PRIMARY KEY NOT NULL,operation_id TEXT NOT NULL REFERENCES account_deletions(operation_id),expires_at INTEGER NOT NULL) STRICT;
`};
