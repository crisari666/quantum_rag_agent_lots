import type { ProjectDocument } from '../projects/schemas/project.schema';

const MAX_MEDIA_FILES = 120;

const STOPWORDS = new Set([
  'dame', 'las', 'los', 'una', 'uno', 'del', 'por', 'que', 'the', 'and',
  'with', 'from', 'show', 'give', 'list', 'all', 'any', 'some', 'this',
  'that', 'what', 'when', 'where', 'which', 'about', 'please', 'need',
  'want', 'like', 'have', 'para', 'con', 'sobre', 'cual', 'quien',
  'como', 'donde', 'cuando', 'puedes', 'puedo', 'quiero', 'necesito',
  'imagenes', 'imágenes', 'images', 'fotos', 'photos', 'videos', 'video',
  'galeria', 'galería', 'gallery', 'proyecto', 'proyectos', 'project',
  'projects', 'lote', 'lotes', 'lots',
]);

export type AgentChatMediaKind =
  | 'image'
  | 'horizontalImage'
  | 'cardProject'
  | 'verticalVideo'
  | 'reelVideo'
  | 'plane'
  | 'brochure';

export interface AgentChatMediaFile {
  readonly kind: AgentChatMediaKind;
  readonly filename: string;
}

export interface AgentChatMediaProject {
  readonly projectId: string;
  readonly title: string;
  readonly location: string;
  readonly files: readonly AgentChatMediaFile[];
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9áéíóúüñ\s-]/gi, ' ');
}

function extractKeywords(question: string): string[] {
  const raw = normalizeForMatch(question)
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return [...new Set(raw)];
}

/**
 * Narrows projects when the question contains place/product tokens (e.g. "Cartagena").
 * If no tokens match any project, returns empty so caller can fall back to all listed projects.
 */
export function filterProjectsByQuestionKeywords(
  projects: readonly ProjectDocument[],
  question: string,
): ProjectDocument[] {
  const keywords = extractKeywords(question);
  if (keywords.length === 0) {
    return [];
  }
  return projects.filter((p) => {
    const hay = normalizeForMatch(
      `${p.title} ${p.location} ${p.city ?? ''} ${p.country ?? ''} ${p.slug ?? ''}`,
    );
    return keywords.some((k) => hay.includes(k));
  });
}

function pushFile(
  files: AgentChatMediaFile[],
  total: { n: number },
  kind: AgentChatMediaKind,
  name: string | undefined,
): void {
  const filename = (name ?? '').trim();
  if (!filename || total.n >= MAX_MEDIA_FILES) return;
  files.push({ kind, filename });
  total.n += 1;
}

export function buildAgentChatMediaFromProjects(
  projects: readonly ProjectDocument[] | null | undefined,
): readonly AgentChatMediaProject[] {
  if (!projects?.length) {
    return [];
  }
  const out: AgentChatMediaProject[] = [];
  const total = { n: 0 };
  for (const p of projects) {
    const files: AgentChatMediaFile[] = [];
    for (const img of p.images ?? []) {
      pushFile(files, total, 'image', typeof img === 'string' ? img : String(img));
    }
    for (const img of p.horizontalImages ?? []) {
      pushFile(
        files,
        total,
        'horizontalImage',
        typeof img === 'string' ? img : String(img),
      );
    }
    for (const v of p.verticalVideos ?? []) {
      pushFile(
        files,
        total,
        'verticalVideo',
        typeof v === 'string' ? v : String(v),
      );
    }
    pushFile(files, total, 'cardProject', p.cardProject);
    pushFile(files, total, 'reelVideo', p.reelVideo);
    pushFile(files, total, 'plane', p.plane);
    pushFile(files, total, 'brochure', p.brochure);
    if (files.length === 0) {
      continue;
    }
    out.push({
      projectId: String(p._id),
      title: p.title,
      location: p.location ?? '',
      files,
    });
  }
  return out;
}
