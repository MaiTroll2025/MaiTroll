import { supabase, PostgrestError, PostgrestResponse } from './supabase';
import { reportSupabaseError } from './bugReporter';

type SafeQueryOptions = {
  table?: string;
  action?: 'select' | 'insert' | 'update' | 'delete' | 'rpc';
  streamId?: string;
  functionName?: string;
};

/**
 * Wraps supabase.from().select() with automatic error logging
 */
export async function safeSelect<T>(
  tableName: string,
  options: any = {},
  context: SafeQueryOptions = {}
): Promise<PostgrestResponse<T>> {
  const query = supabase.from(tableName).select(options as any);

  const { data, error } = await query;

  if (error) {
    reportSupabaseError(error, {
      table: tableName,
      action: 'select',
      ...context,
    });
  }

  return { data, error } as PostgrestResponse<T>;
}

/**
 * Wraps supabase.from().insert() with automatic error logging
 */
export async function safeInsert<T>(
  tableName: string,
  values: any,
  options: any = {},
  context: SafeQueryOptions = {}
): Promise<PostgrestResponse<T[] | T>> {
  const query = supabase.from(tableName).insert(values, options);

  const { data, error } = await query;

  if (error) {
    reportSupabaseError(error, {
      table: tableName,
      action: 'insert',
      requestPayload: values,
      ...context,
    });
  }

  return { data, error } as PostgrestResponse<T[] | T>;
}

/**
 * Wraps supabase.from().update() with automatic error logging
 */
export async function safeUpdate<T>(
  tableName: string,
  values: any,
  options: any = {},
  context: SafeQueryOptions = {}
): Promise<PostgrestResponse<T[] | T>> {
  const query = supabase.from(tableName).update(values, options);

  const { data, error } = await query;

  if (error) {
    reportSupabaseError(error, {
      table: tableName,
      action: 'update',
      requestPayload: values,
      ...context,
    });
  }

  return { data, error } as PostgrestResponse<T[] | T>;
}

/**
 * Wraps supabase.from().delete() with automatic error logging
 */
export async function safeDelete(
  tableName: string,
  options: any = {},
  context: SafeQueryOptions = {}
): Promise<PostgrestResponse<Record<string, never>>> {
  const query = supabase.from(tableName).delete(options);

  const { data, error } = await query;

  if (error) {
    reportSupabaseError(error, {
      table: tableName,
      action: 'delete',
      ...context,
    });
  }

  return { data, error } as PostgrestResponse<Record<string, never>>;
}

/**
 * Wraps supabase.rpc() with automatic error logging
 */
export async function safeRpc<T>(
  functionName: string,
  params: Record<string, any> = {},
  context: SafeQueryOptions = {}
): Promise<{ data: T | null; error: PostgrestError | null }> {
  const { data, error } = await supabase.rpc(functionName, params);

  if (error) {
    reportSupabaseError(error, {
      functionName,
      action: 'rpc',
      ...context,
    });
  }

  return { data, error };
}
