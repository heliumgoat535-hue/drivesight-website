// Related posts for a post page. Opinly files the posts under no category and no
// tag, and the blog mixes English (Canada), Spanish (Mexico) and Portuguese
// (Brazil) posts, so the cluster is the post's language: same language first,
// then shared title/description words, then newest. Deterministic, never random.

const MARKERS = {
  pt: ['da', 'dos', 'das', 'em', 'seu', 'sua', 'sem', 'ao', 'pelo', 'pela', 'uma', 'você', 'celular', 'câmera',
    'câmeras', 'não', 'é', 'brasil', 'trás', 'estrada', 'carro', 'grave', 'frente', 'fixar', 'chuva', 'teste',
    'tipos', 'velocidade', 'aplicativo', 'suporte'],
  es: ['el', 'los', 'las', 'en', 'y', 'con', 'tu', 'por', 'del', 'al', 'es', 'una', 'cómo', 'qué', 'méxico',
    'viajes', 'velocidad', 'conductores', 'alternativa', 'vivo', 'registro', 'convierte'],
};
const LANG_TAGS = { en: 'en', es: 'es-MX', pt: 'pt-BR' };

function words(text) {
  return (text || '').toLowerCase().normalize('NFC').match(/[\p{L}\p{N}]+/gu) || [];
}

export function postLanguage(post) {
  const w = words(`${post.title || ''} ${post.description || ''}`);
  const score = (lang) => w.filter((x) => MARKERS[lang].includes(x)).length;
  const pt = score('pt') + (/[ãõç]/i.test(post.title || '') ? 2 : 0);
  const es = score('es') + (/[ñ¿¡]/i.test(post.title || '') ? 2 : 0);
  if (pt < 2 && es < 2) return 'en';
  return pt >= es ? 'pt' : 'es';
}

export function languageTag(post) {
  return LANG_TAGS[postLanguage(post)];
}

const STOP = new Set(['with', 'what', 'that', 'your', 'from', 'this', 'into', 'than', 'para', 'como', 'with', 'does',
  'android', 'dashcam', 'dash', 'drivesight', 'app']);

function topicWords(post) {
  return new Set(words(`${post.title || ''} ${post.description || ''}`).filter((x) => x.length >= 4 && !STOP.has(x)));
}

export function relatedPosts(post, candidates = [], limit = 4) {
  const lang = postLanguage(post);
  const mine = topicWords(post);
  const time = (p) => new Date(p.firstPublishedAt || 0).getTime() || 0;
  return candidates
    .filter((p) => p && p.slug && p.slug !== post.slug)
    .map((p) => {
      const theirs = topicWords(p);
      let shared = 0;
      for (const x of theirs) if (mine.has(x)) shared += 1;
      return { p, same: postLanguage(p) === lang ? 1 : 0, shared, t: time(p) };
    })
    .sort((a, b) => b.same - a.same || b.shared - a.shared || b.t - a.t || a.p.slug.localeCompare(b.p.slug))
    .slice(0, limit)
    .map((x) => x.p);
}
