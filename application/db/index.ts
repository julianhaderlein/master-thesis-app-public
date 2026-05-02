import * as SQLite from 'expo-sqlite';
import { drizzle, ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { Paths } from 'expo-file-system';
import * as schema from './schema';
import { sql } from 'drizzle-orm';

// Database configuration
const DB_NAME = 'personal-finance.db';

// Type for Drizzle instance with schema
export type DrizzleDB = ExpoSQLiteDatabase<typeof schema>;

/**
 * Get the database file path for the current platform
 */
export const getDatabasePath = (): string => {
  return `${Paths.document.uri}/SQLite/${DB_NAME}`;
};

/**
 * Initialize and return SQLite database connection with SQLCipher encryption wrapped with Drizzle ORM.
 * @param dbKey - 64-char hex string (32-byte raw key) derived from the user's password via Argon2id.
 *                Passed as raw key mode: PRAGMA key = "x'<hex>'" — bypasses SQLCipher's internal PBKDF2.
 */
export const openDB = async (dbKey: string): Promise<{drizzle: DrizzleDB, expoSqlite: SQLite.SQLiteDatabase}> => {
  try {
    // Open database with change listener enabled
    const expoSqlite = await SQLite.openDatabaseAsync(DB_NAME, {
      enableChangeListener: true,
      useNewConnection: false,
    });

    // Set encryption key for SQLCipher in raw key mode — must be the first statement after open,
    // before Drizzle wraps the connection. Using execAsync directly because
    // Drizzle's sql template would bind the value as a parameter, breaking the PRAGMA.
    await expoSqlite.execAsync(`PRAGMA key = "x'${dbKey}'";`);

    const db = drizzle(expoSqlite, { schema });

    // Enable foreign keys
    db.run(sql`PRAGMA foreign_keys = ON;`);

    // NOTE: Balance triggers are set up in DatabaseProvider after migrations run,
    // so the transactions/accounts tables are guaranteed to exist.

    return { drizzle: db, expoSqlite: expoSqlite };
  } catch (error) {
    console.error('Failed to open database:', error);
    throw error;
  }
};