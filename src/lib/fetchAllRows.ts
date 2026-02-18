import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch all rows from a table, bypassing the 1000-row default limit.
 */
export async function fetchAllRows(
  table: string,
  options?: {
    select?: string;
    filters?: (query: any) => any;
    orderColumn?: string;
    orderAscending?: boolean;
    batchSize?: number;
  }
): Promise<any[]> {
  const allData: any[] = [];
  const batchSize = options?.batchSize ?? 200;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = (supabase.from as any)(table).select(options?.select || "*");
    if (options?.filters) query = options.filters(query);
    if (options?.orderColumn) query = query.order(options.orderColumn, { ascending: options.orderAscending ?? true });
    query = query.range(offset, offset + batchSize - 1);

    const { data, error } = await query;
    if (error) throw error;

    if (data && data.length > 0) {
      allData.push(...data);
      offset += data.length;
      hasMore = data.length > 0;
    } else {
      hasMore = false;
    }
  }

  return allData;
}
