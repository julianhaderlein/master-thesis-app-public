//  Copied from drizzle-orm/src/expo-sqlite/query.ts
// As described by https://github.com/jsteiner in https://github.com/drizzle-team/drizzle-orm/issues/2660#issuecomment-2518955822
import { addDatabaseChangeListener } from "expo-sqlite";
import { useEffect, useState } from "react";
import { is } from 'drizzle-orm'
import { SQL } from "drizzle-orm/sql";
import { type AnySQLiteSelect, getTableConfig, getViewConfig, SQLiteTable, SQLiteView } from 'drizzle-orm/sqlite-core';
import { SQLiteRelationalQuery } from "drizzle-orm/sqlite-core/query-builders/query";
import { Subquery } from "drizzle-orm/subquery";


const getJoinedTableNames = (query: SQLiteRelationalQuery<any, any>) => {
  if ((query as any).config.with) {
    return Object.keys((query as any).config.with).map(
      (relation: string) => (query as any).tableConfig.relations[relation].referencedTableName,
    );
  } else if ((query as any).config.joins) {
    return (query as any).config.joins.map(
      (join: any) => join.table[Symbol.for("drizzle:BaseName")],
    );
  } else {
    return [];
  }
};


export const useLiveRelationalQuery = <T extends Pick<AnySQLiteSelect, '_' | 'then'> | SQLiteRelationalQuery<'sync', unknown>>(
	query: T,
	deps: unknown[] = [],
) => {
	const [data, setData] = useState<Awaited<T>>(
		(is(query, SQLiteRelationalQuery) && (query as any).mode === 'first' ? undefined : []) as Awaited<T>,
	);
	const [error, setError] = useState<Error>();
	const [updatedAt, setUpdatedAt] = useState<Date>();

	useEffect(() => {
		const entity = is(query, SQLiteRelationalQuery) ? (query as any).table : (query as any).config.table;

		if (is(entity, Subquery) || is(entity, SQL)) {
			setError(new Error('Selecting from subqueries and SQL are not supported in useLiveQuery'));
			return;
		}

		let listener: ReturnType<typeof addDatabaseChangeListener> | undefined;

		const handleData = (data: any) => {
			setData(data);
			setUpdatedAt(new Date());
		};

		query.then(handleData).catch(setError);

		    if (is(entity, SQLiteTable) || is(entity, SQLiteView)) {
      const config = is(entity, SQLiteTable)
        ? getTableConfig(entity)
        : getViewConfig(entity);
      const relationTableNames = is(query, SQLiteRelationalQuery) ? getJoinedTableNames(query as any) : [];
      const listeningTables = [config.name, ...relationTableNames];

      listener = addDatabaseChangeListener(({ tableName }) => {
        if (listeningTables.includes(tableName)) {
          query.then(handleData).catch(setError);
        }
      });
    }

		return () => {
			listener?.remove();
		};
	}, deps);

	return {
		data,
		error,
		updatedAt,
	} as const;
};