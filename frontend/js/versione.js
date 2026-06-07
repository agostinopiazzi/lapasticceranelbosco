// Single source of truth for the data format version.
// Kept dependency-free (no Dexie/DOM) so validation and migration logic can be
// imported and unit-tested in isolation. See docs/formato-file-json.md.
export const DATA_VERSION = 2;
