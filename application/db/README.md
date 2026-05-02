# Local Database Setup

This directory contains the local database infrastructure using expo-sqlite with SQLCipher encryption and Drizzle ORM.

> **Architecture Note**: The raw SQLite database is kept internal. All database access is through the Drizzle ORM instance, which provides type-safe queries and better abstraction.

## Structure

```
db/
├── index.ts              # Database initialization (raw DB is internal)
├── provider.tsx          # React Context provider for Drizzle instance
├── schema/               # Drizzle schema definitions
│   ├── account.ts        # Account entity
│   ├── transaction.ts    # Transaction entity
│   ├── category.ts       # Category entity
│   ├── tag.ts            # Tag entity
│   ├── budget.ts         # Budget entity
│   ├── goal.ts           # Goal entity
│   ├── space.ts          # Space entity
│   ├── relations.ts      # Join tables for many-to-many relationships
│   └── index.ts          # Exports all schemas
drizzle/                  # Database migrations (managed by drizzle-kit)
├── *.sql                 # Migration files
├── migrations.js         # Migration bundle for Expo
└── meta/                 # Migration metadata
```

## Database Schema

### Entities

1. **Account** - Financial accounts (checking, savings, credit cards, etc.)
   - Fields: id, userId, name, type, currency, balance, icon, color, isActive, timestamps
   
2. **Transaction** - Financial transactions (income/expense)
   - Fields: id, userId, accountId, categoryId, amount, type, description, date, notes, timestamps
   - Foreign Keys: 
     - accountId → Account (cascade delete)
     - categoryId → Category (set null on delete)

3. **Category** - Transaction categories (can have parent categories for subcategories)
   - Fields: id, userId, name, type, icon, color, parentId, isActive, timestamps

4. **Tag** - Tags for organizing transactions
   - Fields: id, userId, name, color, timestamps

5. **Budget** - Budget tracking for categories
   - Fields: id, userId, categoryId, amount, period, startDate, endDate, isActive, timestamps
   - Foreign Key: categoryId → Category (cascade delete)

6. **Goal** - Financial goals
   - Fields: id, userId, name, description, targetAmount, currentAmount, targetDate, icon, color, isCompleted, timestamps

7. **Space** - Organizational spaces (e.g., personal, business, family)
   - Fields: id, userId, name, description, icon, color, isActive, timestamps

### Join Tables (Many-to-Many Relationships)

- **transaction_tags** - Links transactions to tags
  - Primary Key: (transactionId, tagId)
  - Foreign Keys: cascade delete on both sides

- **transaction_spaces** - Links transactions to spaces
  - Primary Key: (transactionId, spaceId)
  - Foreign Keys: cascade delete on both sides

## Usage

### In Components

The database provider uses React Suspense for async initialization. Wrap your app with the provider inside a Suspense boundary:

```tsx
import { Suspense } from 'react';
import { DatabaseProvider, useDatabase } from '@/db/provider';
import { ErrorBoundary } from '@/app/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <DatabaseProvider>
          <YourApp />
        </DatabaseProvider>
      </Suspense>
    </ErrorBoundary>
  );
}

function YourApp() {
  const { db } = useDatabase(); // No need to check for loading/error states
  
  // Database is guaranteed to be ready here
  return <View>...</View>;
}
```

### Direct Queries

```tsx
import { eq } from 'drizzle-orm';
import { accounts } from '@/db/schema';
import { useDatabase } from '@/db/provider';

function MyComponent() {
  const { db } = useDatabase();

  useEffect(() => {
    const fetchAccounts = async () => {
      const userAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, 'user-id'));
    };
    fetchAccounts();
  }, [db]);

  return <View>...</View>;
}
```

## Migrations

To generate a new migration after schema changes:

```bash
npx drizzle-kit generate
```

Migrations are automatically applied when the app starts through the DatabaseProvider.

## Security

- Database is encrypted using SQLCipher with a password
- **TODO**: Move the encryption password from `db/index.ts` to secure storage (e.g., react-native-keychain)
- Foreign key constraints are enabled to maintain referential integrity

## Features

- ✅ SQLCipher encryption for data security
- ✅ Automatic migrations on app start
- ✅ Type-safe database queries with Drizzle ORM
- ✅ Foreign key relationships with cascade/set null rules
- ✅ Many-to-many relationships via join tables
- ✅ React Suspense integration for clean async handling
- ✅ ErrorBoundary support for graceful error handling
- ✅ Timestamp fields for all entities
- ✅ Support for soft deletes via isActive flags
- ✅ Singleton database instance pattern
