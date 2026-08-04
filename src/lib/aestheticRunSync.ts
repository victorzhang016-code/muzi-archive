import type { AnalysisRun } from './aestheticAnalysisV3';
import { supabase } from './supabase';

export async function loadSyncedAestheticRun() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('aesthetic_analysis_runs')
    .select('run, snapshot_hash, engine_version, generated_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.run && typeof data.run === 'object' ? data.run : null) as AnalysisRun | null;
}

export async function saveSyncedAestheticRun(run: AnalysisRun) {
  if (!supabase) throw new Error('Supabase 未配置');
  const { data: session } = await supabase.auth.getSession();
  const ownerId = session.session?.user.id;
  if (!ownerId) throw new Error('登录状态已失效，请重新登录');
  const { error } = await supabase.from('aesthetic_analysis_runs').upsert({
    owner_id: ownerId,
    snapshot_hash: run.inputSnapshotHash,
    engine_version: run.engineVersion,
    run,
    generated_at: run.generatedAt,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
