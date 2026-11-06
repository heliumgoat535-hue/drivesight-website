import test from 'node:test';
import assert from 'node:assert/strict';
import { postLanguage, languageTag, relatedPosts } from '../src/opinly/related.js';
import { pageTitle } from '../src/opinly/seo.js';

// Titles as published on the blog (2026-11).
const posts = [
  { slug: 'gov', title: 'Government Aircraft Alerts: Awareness, Not Speed Cameras', firstPublishedAt: '2026-10-01' },
  { slug: 'winter', title: 'Canadian Winter vs. Your Phone Dashcam: Cold-Weather Fixes', firstPublishedAt: '2026-10-05' },
  { slug: 'hardwire', title: 'Hardwire Kit for Phone Dashcam: Why Canadian Drivers Need Permanent Power', firstPublishedAt: '2026-09-20' },
  { slug: 'chuva', title: 'Chuva Forte e Alagamento: Alertas do DriveSight no Brasil', firstPublishedAt: '2026-10-02' },
  { slug: 'duas', title: 'Duas Câmeras no Android: Grave Frente e Trás ao Mesmo Tempo', firstPublishedAt: '2026-09-28' },
  { slug: 'teste', title: 'Teste de Velocidade: 5 Tipos Que Todo Usuário Android Deve Conhecer', firstPublishedAt: '2026-09-01' },
  { slug: 'radar-mx', title: 'Detector de Radar de Velocidad en México: Alertas Legales vs. Jammers', firstPublishedAt: '2026-09-25' },
  { slug: 'velocimetro', title: 'Velocímetro en Vivo y Registro de Viajes: Dashcam Android', firstPublishedAt: '2026-10-08' },
];

test('postLanguage tells the blog\'s three languages apart', () => {
  assert.deepEqual(posts.map(postLanguage), ['en', 'en', 'en', 'pt', 'pt', 'pt', 'es', 'es']);
  assert.equal(languageTag(posts[3]), 'pt-BR');
  assert.equal(languageTag(posts[6]), 'es-MX');
});

test('relatedPosts: same language first, never the post itself, deterministic', () => {
  const r = relatedPosts(posts[3], posts, 4);
  assert.equal(r.length, 4);
  assert.ok(!r.some((p) => p.slug === 'chuva'));
  assert.deepEqual(r.slice(0, 2).map(postLanguage), ['pt', 'pt']);
  assert.deepEqual(relatedPosts(posts[3], posts, 4), r);
  // every post is linked from at least one other post
  const inbound = new Set(posts.flatMap((p) => relatedPosts(p, posts, 4).map((x) => x.slug)));
  assert.equal(inbound.size, posts.length);
});

test('pageTitle drops the site suffix rather than pass 60 characters', () => {
  assert.equal(pageTitle('Short title'), 'Short title | DriveSight');
  assert.equal(pageTitle('Phone Dashcam Footage: Save, Trim and Hand It Over'), 'Phone Dashcam Footage: Save, Trim and Hand It Over');
  assert.equal(pageTitle('DriveSight Blog: Phone Dash Cam Guides'), 'DriveSight Blog: Phone Dash Cam Guides');
});
