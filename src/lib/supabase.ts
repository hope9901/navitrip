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

export interface LoadedPlanIdentity {
  id: string;
  title: string;
  authorName: string;
}

export function normalizePlanTitle(title: string): string {
  return (title || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function normalizeUserName(userName: string): string {
  return (userName || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export interface PlanSaveOptions {
  plan: PlanData;
  loadedPlanIdentity?: LoadedPlanIdentity | null;
  currentUserName: string;
}

export interface PlanSaveResult {
  id: string;
  title: string;
  authorName: string;
  manageToken: string;
  isNewPlan: boolean;
  isLocalFallback: boolean;
  message: string;
}

// Find existing plan owned by authorName with matching normalized title
export async function findPlanByAuthorAndTitle(
  authorName: string,
  title: string
): Promise<{ id: string; authorName: string; title: string; tokenHash?: string } | null> {
  const normAuthor = normalizeUserName(authorName);
  const normTitle = normalizePlanTitle(title);

  if (!normAuthor || !normTitle) return null;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('id, title, author_name, token_hash, normalized_title, normalized_author_name')
        .eq('normalized_author_name', normAuthor)
        .eq('normalized_title', normTitle)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          title: data.title,
          authorName: data.author_name,
          tokenHash: data.token_hash,
        };
      }

      // Fallback query by author_name if normalized columns not yet populated
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('plans')
        .select('id, title, author_name, token_hash')
        .eq('author_name', authorName.trim())
        .limit(20);

      if (!fallbackErr && fallbackData && fallbackData.length > 0) {
        const match = fallbackData.find((p) => normalizePlanTitle(p.title) === normTitle);
        if (match) {
          return {
            id: match.id,
            title: match.title,
            authorName: match.author_name,
            tokenHash: match.token_hash,
          };
        }
      }
    } catch (e) {
      console.warn('findPlanByAuthorAndTitle DB query error:', e);
    }
  }

  // LocalStorage Fallback Search
  if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('travel_plan_')) {
        const val = localStorage.getItem(key);
        if (val) {
          try {
            const parsed = JSON.parse(val);
            if (
              normalizeUserName(parsed.authorName || '익명') === normAuthor &&
              normalizePlanTitle(parsed.title || '') === normTitle
            ) {
              return {
                id: parsed.id,
                title: parsed.title,
                authorName: parsed.authorName,
              };
            }
          } catch {
            // ignore
          }
        }
      }
    }
  }

  return null;
}

// Save plan function enforcing all 6 save rules
export async function savePlanToDB(options: PlanSaveOptions): Promise<PlanSaveResult> {
  const { plan, loadedPlanIdentity, currentUserName } = options;

  const rawTitle = (plan.title || '').trim();
  if (!rawTitle) {
    throw new Error('여행 일정 이름을 입력해 주세요.');
  }

  const rawAuthor = (currentUserName || plan.authorName || '익명').trim();
  const normTitle = normalizePlanTitle(rawTitle);
  const normAuthor = normalizeUserName(rawAuthor);

  const loadedNormTitle = loadedPlanIdentity ? normalizePlanTitle(loadedPlanIdentity.title) : null;
  const loadedNormAuthor = loadedPlanIdentity ? normalizeUserName(loadedPlanIdentity.authorName) : null;

  const isTitleChanged = loadedPlanIdentity ? normTitle !== loadedNormTitle : false;
  const isAuthorChanged = loadedPlanIdentity ? normAuthor !== loadedNormAuthor : false;

  let targetPlanId = plan.id;
  let isNewPlan = false;

  if (loadedPlanIdentity && plan.id && !isTitleChanged && !isAuthorChanged) {
    // Rule 1 & 6: Same user + Same title as loaded plan -> Update current loaded plan
    targetPlanId = plan.id;
    isNewPlan = false;
  } else {
    // Rule 2, 3, 4, 5: Title changed or Author changed or New plan -> Search for existing same author+title plan
    const existing = await findPlanByAuthorAndTitle(rawAuthor, rawTitle);

    if (existing) {
      const existingToken = getStoredManageToken(existing.id);
      if (existingToken) {
        // User owns management token for existing same title plan -> Update it
        targetPlanId = existing.id;
        isNewPlan = false;
      } else {
        // Same title plan exists but current browser lacks management token
        throw new Error(`'${rawTitle}' 이름의 기존 일정이 있지만 수정 권한이 없습니다. 다른 이름으로 변경해 주세요.`);
      }
    } else {
      // Create brand new plan
      targetPlanId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      isNewPlan = true;
    }
  }

  const sanitizedDays = sanitizePlanPlaces(plan.days);
  let manageToken = getStoredManageToken(targetPlanId);
  if (!manageToken) {
    manageToken = generateManageToken();
  }
  saveStoredManageToken(targetPlanId, manageToken);

  const tokenHash = await sha256Browser(manageToken);

  const payload = {
    ...plan,
    id: targetPlanId,
    title: rawTitle,
    authorName: rawAuthor,
    manageToken,
    mapView: plan.mapView,
    days: sanitizedDays,
    updatedAt: new Date().toISOString(),
  };

  let message = '';
  if (isNewPlan) {
    message = `'${rawTitle}'이(가) 새로운 일정으로 저장되었습니다.`;
  } else if (isTitleChanged) {
    message = `동일한 이름의 기존 일정('${rawTitle}')에 변경사항을 저장했습니다.`;
  } else {
    message = `'${rawTitle}' 일정이 업데이트되었습니다.`;
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const record = {
        id: targetPlanId,
        title: rawTitle,
        author_name: rawAuthor,
        normalized_title: normTitle,
        normalized_author_name: normAuthor,
        token_hash: tokenHash,
        map_view: plan.mapView,
        days: sanitizedDays,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('plans')
        .upsert(record)
        .select()
        .single();

      if (error) {
        if (
          error.code === '42703' ||
          error.message?.includes('normalized_') ||
          error.message?.includes('token_hash') ||
          error.message?.includes('map_view')
        ) {
          const { data: retryData, error: retryErr } = await supabase
            .from('plans')
            .upsert({
              id: targetPlanId,
              title: rawTitle,
              author_name: rawAuthor,
              days: sanitizedDays,
              created_at: plan.createdAt || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (retryErr) throw retryErr;
          return {
            id: retryData.id,
            title: rawTitle,
            authorName: rawAuthor,
            manageToken,
            isNewPlan,
            isLocalFallback: false,
            message,
          };
        }
        throw error;
      }
      return {
        id: data.id,
        title: rawTitle,
        authorName: rawAuthor,
        manageToken,
        isNewPlan,
        isLocalFallback: false,
        message,
      };
    } catch (err) {
      console.warn('Supabase save error, falling back to LocalStorage:', err);
    }
  }

  // LocalStorage Fallback
  if (typeof window !== 'undefined') {
    localStorage.setItem(`travel_plan_${targetPlanId}`, JSON.stringify(payload));
  }
  return {
    id: targetPlanId,
    title: rawTitle,
    authorName: rawAuthor,
    manageToken,
    isNewPlan,
    isLocalFallback: true,
    message,
  };
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
