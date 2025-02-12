# Remove all revision in Ghost Database

## Warning ##
1. Backup your database before making changes
2. Apply for SQLite3 database
3. Ghost CMS version 5

## Walkthrough

1. **Backup your database**
```bash
cp /var/lib/ghost/content/data/ghost.db ghost.db.backup
```

2. Install sqlite3
```bash
apt-get update && apt-get install sqlite3
```

3. Open the SQLite database
```bash
sqlite3 ghost.db
```

4. *(Optional)* List tables to confim the revision table
```sql
.tables
```

5. Delete all revisions
```sql
DELETE FROM post_revisions;
```

6. Verify the deletion
```sql
SELECT COUNT(*) FROM post_revisions;
```

7. *(Recommended)* Optimize the database
```sql
VACUUM;
```
This will reclaim unused space and reduce the database size.

## Notes ##
The structure of the `post_revisions` table may vary between versions.
