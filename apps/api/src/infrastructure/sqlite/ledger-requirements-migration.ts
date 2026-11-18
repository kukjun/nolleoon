import type {Migration} from './migrations.js';
export const ledgerRequirementsMigration:Migration={version:17,name:'durable-privacy-ledger-requirements',sql:`
CREATE TABLE privacy_ledger_requirements(namespace TEXT PRIMARY KEY NOT NULL CHECK(namespace IN ('account','room')),binding_hash TEXT NOT NULL,known_sequence INTEGER NOT NULL CHECK(known_sequence>=0),known_digest TEXT NOT NULL) STRICT;
`};
