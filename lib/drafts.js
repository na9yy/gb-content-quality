// Pre-publish check: score pasted text or a Google Doc before it goes live.
import { scoreContent } from './pipeline';
import { googleToken, serviceAccount } from './google';
import { db } from './supabase';
import { RUBRIC_VERSION, scoreLabel } from './rubric';

export async function fetchGoogleDoc(link) {
  const id = link.match(/\/d\/([a-zA-Z0-9_-]{20,})/)?.[1] || (/^[a-zA-Z0-9_-]{20,}$/.test(link) ? link : null);
  if (!id) throw new Error('Could not read a Google Doc ID from that link.');
  const token = await googleToken('https://www.googleapis.com/auth/drive.readonly');
  const h = { authorization: `Bearer ${token}` };
  const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=name&supportsAllDrives=true`, { headers: h });
  if (meta.status === 404 || meta.status === 403) throw new Error(`No access. Share the doc with ${serviceAccount().client_email} (Viewer), or check that the Google Drive API is enabled.`);
  const m = await meta.json();
  if (!meta.ok) throw new Error(`Drive ${meta.status}: ${m.error?.message}`);
  let r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/markdown`, { headers: h });
  if (!r.ok) r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/plain`, { headers: h });
  if (!r.ok) throw new Error(`Could not export doc (${r.status}).`);
  return { title: m.name, markdown: await r.text() };
}

export async function checkDraft({ text, docUrl, title, pageType = 'blog', createdBy }) {
  let markdown = text || '', docTitle = title;
  if (docUrl) { const d = await fetchGoogleDoc(docUrl); markdown = d.markdown; docTitle = title || d.title; }
  if (!markdown || markdown.trim().length < 200) throw new Error('Draft is too short to score (min ~200 characters).');
  if (docTitle && !/^#\s/m.test(markdown)) markdown = `# ${docTitle}\n\n${markdown}`;
  const url = 'https://gameboost.com/draft';
  const { x, checks, dims, overall, llm } = await scoreContent({ url, pageType, markdown, metadata: { title: docTitle || '' }, isDraft: true });
  const result = {
    draft: true, title: docTitle || x.h1 || 'Untitled draft', pageType, verdict: scoreLabel(overall, 'overall'), game: llm.game, isYmyl: llm.isYmyl, overall, wordCount: x.wordCount,
    scoredAt: new Date().toISOString(), meta: { model: llm.model, usage: llm.usage }, rubric: RUBRIC_VERSION,
    dimensions: dims.map(d => ({ ...d, checks: checks.filter(c => c.dim === d.dim).map(c => ({ key: c.key, method: c.method, verdict: c.verdict, weight: c.weight, evidence: c.evidence, reason: c.reason })) })),
  };
  const { data } = await db().from('drafts').insert({ title: result.title, page_type: pageType, source: docUrl ? 'gdoc' : 'paste', doc_url: docUrl || null, word_count: x.wordCount, overall, result, created_by: createdBy || null }).select('id').single();
  return { ...result, draftId: data?.id };
}

export async function listDrafts() {
  const { data } = await db().from('drafts').select('id, title, page_type, source, word_count, overall, created_by, created_at').order('created_at', { ascending: false }).limit(100);
  return data || [];
}
export async function getDraft(id) {
  const { data } = await db().from('drafts').select('id, result').eq('id', id).single();
  return data ? { ...data.result, draftId: data.id } : null;
}
