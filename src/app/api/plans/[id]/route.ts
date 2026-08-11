import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: planId } = await params;
  const manageToken = request.headers.get('x-manage-token') || '';
  const authorName = request.headers.get('x-author-name') || '';

  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: true, isLocalFallback: true, message: 'Supabase가 설정되지 않았습니다. 로컬에서만 삭제됩니다.' },
      { status: 200 }
    );
  }

  try {
    const { data: existingPlan, error: fetchErr } = await supabase
      .from('plans')
      .select('id, author_name, token_hash')
      .eq('id', planId)
      .single();

    if (fetchErr || !existingPlan) {
      return NextResponse.json(
        { ok: false, error: 'PLAN_NOT_FOUND', message: '삭제하려는 일정을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    let isAuthorized = false;

    if (existingPlan.token_hash) {
      if (manageToken && hashToken(manageToken) === existingPlan.token_hash) {
        isAuthorized = true;
      }
    } else {
      // Legacy plan fallback: check authorName match or admin author
      if (authorName && (existingPlan.author_name === authorName || authorName.toLowerCase() === 'admin' || authorName === '어드민')) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '일정 삭제 권한이 없습니다. (관리 토큰이 일치하지 않습니다)' },
        { status: 403 }
      );
    }

    const { error: deleteErr } = await supabase.from('plans').delete().eq('id', planId);

    if (deleteErr) {
      console.error('[Delete Plan DB Error]:', deleteErr);
      return NextResponse.json(
        { ok: false, error: 'DB_DELETE_FAILED', message: `DB 일정 삭제에 실패했습니다: ${deleteErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id: planId, message: '일정이 성공적으로 삭제되었습니다.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '서버 내부 오류가 발생했습니다.';
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR', message: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: planId } = await params;
  const manageToken = request.headers.get('x-manage-token') || '';
  const authorName = request.headers.get('x-author-name') || '';

  let body: { title?: string } = {};
  try {
    body = await request.json();
  } catch {
    // ignore
  }

  const newTitle = body.title?.trim();
  if (!newTitle) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_TITLE', message: '수정할 일정 제목을 입력해 주세요.' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, isLocalFallback: true }, { status: 200 });
  }

  try {
    const { data: existingPlan, error: fetchErr } = await supabase
      .from('plans')
      .select('id, author_name, token_hash')
      .eq('id', planId)
      .single();

    if (fetchErr || !existingPlan) {
      return NextResponse.json(
        { ok: false, error: 'PLAN_NOT_FOUND', message: '수정하려는 일정을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    let isAuthorized = false;
    if (existingPlan.token_hash) {
      if (manageToken && hashToken(manageToken) === existingPlan.token_hash) {
        isAuthorized = true;
      }
    } else {
      if (authorName && (existingPlan.author_name === authorName || authorName.toLowerCase() === 'admin' || authorName === '어드민')) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '일정 제목 수정 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { error: updateErr } = await supabase
      .from('plans')
      .update({ title: newTitle, updated_at: new Date().toISOString() })
      .eq('id', planId);

    if (updateErr) {
      return NextResponse.json(
        { ok: false, error: 'DB_UPDATE_FAILED', message: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id: planId, title: newTitle });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '서버 오류';
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR', message: msg }, { status: 500 });
  }
}
