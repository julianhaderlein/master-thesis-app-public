import React, { createContext, useContext, ReactNode, use, useState, useEffect } from 'react';
import { openDB, type DrizzleDB } from './index';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '@/drizzle/migrations';
import * as SQLite from 'expo-sqlite';
import { useDrizzleStudio } from 'expo-drizzle-studio-plugin';
import * as schema from '@/db/schema';
import { defaultCategories } from '@/db/seeds/default-categories';
import { sql } from 'drizzle-orm';
import { useAuth } from '@/services/auth-provider';

interface DatabaseContextType {
  db: DrizzleDB;
  _expoSqlite: SQLite.SQLiteDatabase;
  rotateDBKey: (newHashedPassword: string) => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }
  return context;
};

// Keyed promise cache so a new promise is created when dbKey changes (e.g. after password rotation)
const databasePromises = new Map<string, Promise<DatabaseContextType>>();

const initializeDatabase = async (dbKey: string): Promise<DatabaseContextType> => {
  try {
    const { drizzle, expoSqlite } = await openDB(dbKey);
    const rotateDBKey = async (newHashedPassword: string) => {
      await expoSqlite.execAsync(`PRAGMA rekey = "x'${newHashedPassword}'";`);
    };
    return { db: drizzle, _expoSqlite: expoSqlite, rotateDBKey };
  } catch (err) {
    console.error('Database initialization failed:', err);
    throw err;
  }
};

const getDatabaseInstance = (dbKey: string): DatabaseContextType => {
  if (!databasePromises.has(dbKey)) {
    databasePromises.set(dbKey, initializeDatabase(dbKey));
  }
  // Using React's `use` hook to unwrap the promise for Suspense
  return use(databasePromises.get(dbKey)!);
};

// Inner component that handles migrations after database is ready
const DatabaseProviderInner: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { hashedPassword } = useAuth();
  const { db, _expoSqlite, rotateDBKey } = getDatabaseInstance(hashedPassword);

  useDrizzleStudio(_expoSqlite);

  // Apply migrations using the hook
  const { success, error } = useMigrations(db, migrations);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (success) {
      // Set up account balance triggers now that tables exist
      const INSERT_TRIGGER = 'refresh_account_balance_on_insert';
      const UPDATE_TRIGGER = 'refresh_account_balance_on_update';
      const DELETE_TRIGGER = 'refresh_account_balance_on_delete';

      db.run(sql`DROP TRIGGER IF EXISTS ${sql.raw(INSERT_TRIGGER)};`);
      db.run(sql`DROP TRIGGER IF EXISTS ${sql.raw(UPDATE_TRIGGER)};`);
      db.run(sql`DROP TRIGGER IF EXISTS ${sql.raw(DELETE_TRIGGER)};`);

      db.run(sql.join([
        sql`CREATE TRIGGER IF NOT EXISTS ${sql.raw(INSERT_TRIGGER)} AFTER INSERT ON ${schema.transactions} BEGIN UPDATE ${schema.accounts} SET`,
        sql.raw(`"${schema.accounts.balance.name}" = "${schema.accounts.balance.name}" + NEW."${schema.transactions.signedAmount.name}" WHERE "${schema.accounts.id.name}" = NEW."${schema.transactions.accountId.name}"; END;`),
      ]));

      db.run(sql.join([
        sql`CREATE TRIGGER IF NOT EXISTS ${sql.raw(UPDATE_TRIGGER)} AFTER UPDATE ON ${schema.transactions} BEGIN UPDATE ${schema.accounts} SET`,
        sql.raw(`"${schema.accounts.balance.name}" = "${schema.accounts.balance.name}" - OLD."${schema.transactions.signedAmount.name}" WHERE "${schema.accounts.id.name}" = OLD."${schema.transactions.accountId.name}";`),
        sql`UPDATE ${schema.accounts} SET`,
        sql.raw(`"${schema.accounts.balance.name}" = "${schema.accounts.balance.name}" + NEW."${schema.transactions.signedAmount.name}" WHERE "${schema.accounts.id.name}" = NEW."${schema.transactions.accountId.name}"; END;`),
      ]));

      db.run(sql.join([
        sql`CREATE TRIGGER IF NOT EXISTS ${sql.raw(DELETE_TRIGGER)} AFTER DELETE ON ${schema.transactions} BEGIN UPDATE ${schema.accounts} SET`,
        sql.raw(`"${schema.accounts.balance.name}" = "${schema.accounts.balance.name}" - OLD."${schema.transactions.signedAmount.name}" WHERE "${schema.accounts.id.name}" = OLD."${schema.transactions.accountId.name}"; END;`),
      ]));

      // Seed default categories once per launch (idempotent via onConflictDoNothing)
      db.insert(schema.categories)
        .values(defaultCategories)
        .onConflictDoNothing()
        .catch((err) => console.warn('[DB] Category seed failed:', err));

      setIsReady(true);
    }
  }, [success]);

  // Throw error if migrations fail (will be caught by ErrorBoundary)
  if (error) {
    throw new Error(`Migration failed: ${error.message}`);
  }

  // Keep showing loading state while migrations are running
  if (!isReady) {
    return null; // Return null to keep Suspense fallback showing
  }

  const value: DatabaseContextType = { db, _expoSqlite, rotateDBKey };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const DatabaseProvider = ({ children }: { children: ReactNode }) => {
  return <DatabaseProviderInner>{children}</DatabaseProviderInner>;
};
