import { createClient } from '@supabase/supabase-js';
import { PlanData, DayItinerary, ItineraryBlock } from '@/types/itinerary';
import { normalizePlaceLinks } from '@/lib/naverMapUrl';

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
  hasManageToken?: boolean;
}

// Helper to normalize all places inside a plan's days
function sanitizePlanPlaces(days: DayItinerary[]): DayItinerary[] {
  if (!Array.isArray(days)) return [];
  return days.map((day) => ({
    ...day,
    blocks: Array.isArray(day.blocks)
      ? day.blocks.map((block: ItineraryBlock) => ({
          ...block,
          place: normalizePlaceLinks(block.place),
        }))
      : [],
  }));
}

// Generate random 32-character hex token
export function generateManageToken(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `token_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Browser SHA-256 helper
export async function sha256Browser(message: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return message;
}

export function getStoredManageToken(planId: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`navitrip_manage_token_${planId}`);
}

export function saveStoredManageToken(planId: string, token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`navitrip_manage_token_${planId}`, token);
}

export function removeStoredManageToken(planId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`navitrip_manage_token_${planId}`);
}

// Helper function to save plan to Supabase or LocalStorage
export async function savePlanToDB(plan: PlanData): Promise<{ id: string; manageToken: string; isLocalFallback: boolean }> {
  const planId = plan.id || `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const authorName = plan.authorName || '익명';
  const sanitizedDays = sanitizePlanPlaces(plan.days);

  let manageToken = plan.manageToken || getStoredManageToken(planId);
  if (!manageToken) {
    manageToken = generateManageToken();
  }

  saveStoredManageToken(planId, manageToken);

  const tokenHash = await sha256Browser(manageToken);

  const payload = {
    ...plan,
    id: planId,
    authorName,
    manageToken,
    mapView: plan.mapView,
    days: sanitizedDays,
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
          token_hash: tokenHash,
          map_view: plan.mapView,
          days: sanitizedDays,
          created_at: plan.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        if (
          error.code === '42703' ||
          error.message?.includes('map_view') ||
          error.message?.includes('token_hash') ||
          error.message?.includes('author_name')
        ) {
          const { data: retryData, error: retryErr } = await supabase
            .from('plans')
            .upsert({
              id: planId,
              title: plan.title,
              author_name: authorName,
              days: sanitizedDays,
              created_at: plan.createdAt || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (retryErr) throw retryErr;
          return { id: retryData.id, manageToken, isLocalFallback: false };
        }
        throw error;
      }
      return { id: data.id, manageToken, isLocalFallback: false };
    } catch (err) {
      console.warn('Supabase save error, falling back to LocalStorage:', err);
    }
  }

  // LocalStorage Fallback
  if (typeof window !== 'undefined') {
    localStorage.setItem(`travel_plan_${planId}`, JSON.stringify(payload));
  }
  return { id: planId, manageToken, isLocalFallback: true };
}

// Helper function to load a single plan from Supabase or LocalStorage
export async function loadPlanFromDB(planId: string): Promise<PlanData | null> {
  const localToken = getStoredManageToken(planId);

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
          manageToken: localToken || undefined,
          mapView: data.map_view || data.mapView || undefined,
          days: sanitizePlanPlaces(data.days),
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
        const parsed = JSON.parse(local);
        return {
          ...parsed,
          manageToken: localToken || parsed.manageToken,
          mapView: parsed.mapView || parsed.map_view || undefined,
          days: sanitizePlanPlaces(parsed.days),
        };
      } catch (e) {
        console.error('Error parsing local plan:', e);
      }
    }
  }

  return null;
}

// Helper function to delete plan from Supabase and LocalStorage
export async function deletePlanFromDB(planId: string, authorName?: string): Promise<{ ok: boolean; message?: string }> {
  const manageToken = getStoredManageToken(planId) || '';

  try {
    const res = await fetch(`/api/plans/${planId}`, {
      method: 'DELETE',
      headers: {
        'x-manage-token': manageToken,
        'x-author-name': authorName || '',
      },
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.message || '일정 삭제에 실패했습니다.');
    }
  } catch (err) {
    console.error('Server delete route failed:', err);
    if (!isSupabaseConfigured) {
      // Local fallback proceed
    } else {
      throw err;
    }
  }

  // Remove from LocalStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem(`travel_plan_${planId}`);
    removeStoredManageToken(planId);
  }

  return { ok: true, message: '일정이 성공적으로 삭제되었습니다.' };
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
            hasManageToken: Boolean(getStoredManageToken(item.id)),
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
                hasManageToken: Boolean(getStoredManageToken(parsed.id)),
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
