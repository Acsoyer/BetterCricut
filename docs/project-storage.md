# Project saving and file storage

The Save dialog is separate from My Projects. Save converts the current recovery
record into a named project without creating a second record. Save a Copy creates
a new ID. Rename updates metadata only. Saves and opens share an in-flight lock;
updates check the loaded timestamp to avoid overwriting another tab's changes.

Project packing recursively shares identical image data, including nested image
sources and unweld sources. Only the saved copy merges repeated background
removal steps. The live editing session is never compacted. The retained BGR is
marked baked so reopening refinement starts with the saved result rather than
attempting to replay only the final operation on the original image.

## Enable separate cloud image files

1. Apply `supabase/20260918_project_file_storage.sql` in the correct Supabase
   project's SQL editor, after the existing projects schema.
2. Set `NEXT_PUBLIC_PROJECT_FILE_STORAGE=true` in the build environment.
3. Rebuild, test uploading/opening/saving/copying/deleting with two accounts, and
   deploy only after both cross-user access and missing-file tests pass.

The production build now defaults this flag to true after the SQL migration.
Set it explicitly to false to use the backwards-compatible compact inline
format. Old inline projects migrate only when saved with file storage enabled;
no old records are bulk modified. Do not disable the flag until cloud projects
have been backed up: reads remain supported, but future saves revert to inline.

The private `project-assets` bucket stores content-hashed binary images under
user/project folders. Unchanged files are not re-uploaded. Project size includes
manifest JSON and the referenced binary images, not merely the JSON manifest.
This remains a logical quota, not a measurement of Postgres physical disk usage.

Cleanup uses the Storage API, never direct SQL object deletion. Delete policies
protect files referenced by any saved project. A 24-hour grace period protects
in-flight uploads from other tabs. Cleanup runs on subsequent saves/deletions;
My Projects also scans orphaned project folders at most once per hour per browser.
Upload claims protect old reused files during concurrent saves. For accounts that
never return, a server-side sweeper should use the same reference/claim/grace checks
before broad launch.
Failed saves can leave temporary uploaded files; account for them in capacity
monitoring. The logical 40 MB project quota is not a bucket-wide hard usage cap.

Save dialogs also allow a standalone `.cakeproject` backup to be downloaded.
My Projects can open these backups; importing does not overwrite a cloud record.
Backups include compact saved history and all necessary inline assets.

The migration changes quota enforcement to test the proposed total and serialize
concurrent writes. Existing over-quota projects may still be renamed or shrunk.
It does not delete any user project.
