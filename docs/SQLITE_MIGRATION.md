# SQLite messaging schema migration

The Node runtime opens one SQLite connection in `createDatabase`. Authentication,
sessions, rooms, messages, and read receipts use this connection. `HistoryStore`
uses the same connection for the existing room and messaging API.

## Startup migration

Startup takes `BEGIN IMMEDIATE` before reading rows for migration. This locks out
concurrent writers until the migration either commits or rolls back. It checks
the migration history in order, applies each missing version, and records a
version only after that migration succeeds. Unknown versions, gaps, incompatible
schemas, orphan receipts, and invalid sequences stop startup without dropping
the old schema or its data.

Version 1 unifies the supported message, room, and receipt layouts. Version 2
adds `legacy_data` columns while preserving the current version-1 data. Existing
databases at version 1 are upgraded to version 2 in order.

The room migration maps the supported room names (`name`, `title`, `room_name`, or
`label`) and IDs (`room_id` or `id`). Supported extra room columns are stored in
`legacy_data`, including tagged encodings for SQLite blobs and 64-bit integers.
Room schemas without a supported ID or name are rejected. Extra message or
receipt columns that are not supported are also rejected, so migration does not
silently discard them. A message with no room gets a “Recovered room”.

Version 1 combines receipts from `receipts` and `message_reads`. Duplicate
message/user receipts are reduced to one receipt with the earliest timestamp;
all distinct readers are retained. A message's global `Read` status means at
least one recipient has read it. `readBy` identifies the individual readers.
The latest 50 messages are selected by sequence and returned in insertion order.

## Automatic backup

Before a persisted database is modified by a pending migration, startup creates
a uniquely named sibling file:

`<database>.pre-migration-<timestamp>-<process>-<id>.sqlite`

It is created exclusively, so an existing backup is never overwritten. Node's
SQLite serializer captures the database while the migration write lock is held.
Startup verifies the saved bytes and opens the backup for `PRAGMA integrity_check`
before making schema changes. A failed migration leaves the backup in place,
rolls back the transaction, records no migration version, and closes the failed
connection. `:memory:` databases do not create backups.

## Rollback and restore

If migration fails, the application transaction restores the original schema
and rows; keep the generated backup as an additional recovery copy. If a
successfully migrated database needs to be rolled back, stop every application
process using it. Rename the current database and any `-wal`/`-shm` sidecars to
preserved filenames, then copy the verified pre-migration backup to the original
database path. Keep both the backup and renamed files until the restored
application has been checked. Do not restore while the database is open.

There is no automatic down migration. Rebuilding the old table shapes could
discard receipt or room metadata. Before deployment, retain a separate verified
backup in the normal operational backup system as well; the automatic backup is
for migration recovery, not long-term retention.
