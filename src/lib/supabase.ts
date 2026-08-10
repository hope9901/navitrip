import { createClient } from '@supabase/supabase-js';
import { PlanData } from '@/types/itinerary';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface SavedPlanSummary {
  id: string;
  title: string;
  authorName?: string;
  updatedAt?: string;
  placeCount: number;
}

// Helper function to save plan to Supabase or LocalStorage
export async function savePlanToDB(plan: PlanData): Promise<{ id: string; isLocalFallback: boolean }> {
  const planId = plan.id || `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const authorName = plan.authorName || '익명';
  const payload = {
    ...plan,
    id: planId,
    authorName,
    updatedAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('plans')
        .upsert({
          id: planId,
          title: plan.title,
          author_name: authorName,
          days: plan.days,
          created_at: plan.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        // If author_name column does not exist in Supabase schema, retry upserting without author_name
        if (error.code === '42703' || error.message?.includes('author_name')) {
          const { data: retryData, error: retryErr } = await supabase
            .from('plans')
            .upsert({
              id: planId,
              title: plan.title,
              days: plan.days,
              created_at: plan.createdAt || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();
          if (retryErr) throw retryErr;
          return { id: retryData.id, isLocalFallback: false };
        }
        throw error;
      }
      return { id: data.id, isLocalFallback: false };
    } catch (err) {
      console.warn('Supabase save error, falling back to LocalStorage:', err);
    }
  }

  // LocalStorage Fallback
  if (typeof window !== 'undefined') {
    localStorage.setItem(`travel_plan_${planId}`, JSON.stringify(payload));
  }
  return { id: planId, isLocalFallback: true };
}

// Helper function to load a single plan from Supabase or LocalStorage
export async function loadPlanFromDB(planId: string): Promise<PlanData | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (!error && data) {
        return {
          id: data.id,
          title: data.title,
          authorName: data.author_name || '익명',
          days: data.days,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
    } catch (err) {
      console.warn('Supabase fetch error, checking LocalStorage fallback:', err);
    }
  }

  // LocalStorage Fallback
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(`travel_plan_${planId}`);
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        console.error('Error parsing local plan:', e);
      }
    }
  }

  return null;
}

// Helper function to list saved plans filtered by authorName (Support Admin Mode)
export async function listSavedPlansFromDB(targetAuthorName?: string): Promise<SavedPlanSummary[]> {
  const summaries: SavedPlanSummary[] = [];
  const normalized = (targetAuthorName || '').trim().toLowerCase();
  const isAdmin = normalized === 'admin' || targetAuthorName === '어드민';

  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('plans')
        .select('id, title, author_name, updated_at, days')
        .order('updated_at', { ascending: false })
        .limit(100);

      // If NOT admin, filter strictly by author_name
      if (!isAdmin && targetAuthorName) {
        query = query.eq('author_name', targetAuthorName);
      }

      const { data, error } = await query;

      if (!error && data) {
        for (const item of data) {
          let count = 0;
          if (Array.isArray(item.days)) {
            count = item.days.reduce(
              (acc: number, d: { blocks?: unknown[] }) => acc + (d.blocks?.length || 0),
              0
            );
          }
          summaries.push({
            id: item.id,
            title: item.title || '제목 없음',
            authorName: item.author_name || '익명',
            updatedAt: item.updated_at,
            placeCount: count,
          });
        }
      }
    } catch (err) {
      console.warn('Supabase list error, checking LocalStorage fallback:', err);
    }
  }

  // LocalStorage Fallback
  if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('travel_plan_')) {
        const val = localStorage.getItem(key);
        if (val) {
          try {
            const parsed = JSON.parse(val);
            const itemAuthor = parsed.authorName || '익명';

            // If NOT admin, strictly require matching authorName
            if (!isAdmin && targetAuthorName && itemAuthor !== targetAuthorName) {
              continue;
            }

            if (!summaries.some((s) => s.id === parsed.id)) {
              let count = 0;
              if (Array.isArray(parsed.days)) {
                count = parsed.days.reduce(
                  (acc: number, d: { blocks?: unknown[] }) => acc + (d.blocks?.length || 0),
                  0
                );
              }
              summaries.push({
                id: parsed.id,
                title: parsed.title || '제목 없음',
                authorName: itemAuthor,
                updatedAt: parsed.updatedAt || parsed.created_at,
                placeCount: count,
              });
            }
          } catch {
            // ignore
          }
        }
      }
    }
  }

  return summaries;
}
