// Fixture content shaped like the Opinly /v1 API (see sdk.opinly.ai/v1/openapi.json).
// Used by the unit tests and by scripts/mock-opinly.mjs for local previews.

export const author = {
  name: 'Jordan Reyes',
  slug: 'jordan-reyes',
  fileKey: 'authors/jordan-reyes.jpg',
  bio: 'Writes about phone dash cams, parking mode, and staying out of trouble on the road.',
};

export const categories = [
  { slug: 'guides', name: 'Guides', description: 'Step-by-step setup and how-to articles.' },
  { slug: 'safety', name: 'Driving safety', description: 'Alerts, hazards, and what to do when something happens.' },
];

export const tags = [
  { slug: 'parking-mode', name: 'Parking mode' },
  { slug: 'android', name: 'Android' },
  { slug: 'deer', name: 'Deer' },
];

const doc = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [
      { type: 'text', text: 'Parking mode turns a phone that would otherwise sit idle into a ' },
      { type: 'text', text: 'motion-triggered sentry', marks: [{ type: 'bold' }] },
      { type: 'text', text: '. This guide covers power, mounting, and the settings that matter. See the ' },
      { type: 'text', text: 'accessories page', marks: [{ type: 'link', attrs: { href: '/accessories' } }] },
      { type: 'text', text: ' for hardware.' },
    ] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Power comes first' }] },
    { type: 'paragraph', content: [
      { type: 'text', text: 'A phone recording all night draws roughly ' },
      { type: 'text', text: '3–5 W', marks: [{ type: 'code' }] },
      { type: 'text', text: '. Use an OBD or fuse-tap cable with a voltage cutoff so the car still starts in the morning. ' },
      { type: 'text', text: 'Never', marks: [{ type: 'italic' }] },
      { type: 'text', text: ' rely on a cigarette socket that stays live.' },
    ] },
    { type: 'image', attrs: { fileKey: 'posts/parking-mode/obd-cable.jpg', alt: 'OBD power cable with a voltmeter readout', caption: 'An OBD cable with a voltmeter shows when the battery is getting low.', width: 1200, height: 800 } },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Mounting and angle' }] },
    { type: 'bulletList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mount high on the windshield, behind the mirror.' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep the lens clear of tint bands and the wiper dead zone.' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [
        { type: 'text', text: 'Use a magnetic mount so the phone comes off in one motion. Details in ' },
        { type: 'text', text: 'this external guide', marks: [{ type: 'link', attrs: { href: 'https://example.com/mounts', target: '_blank' } }] },
        { type: 'text', text: '.' },
      ] }] },
    ] },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Suggested settings' }] },
    { type: 'table', content: [
      { type: 'tableRow', content: [
        { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Setting' }] }] },
        { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Value' }] }] },
      ] },
      { type: 'tableRow', content: [
        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Motion sensitivity' }] }] },
        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Medium' }] }] },
      ] },
      { type: 'tableRow', content: [
        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Threat window' }] }] },
        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '3 seconds' }] }] },
      ] },
    ] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What the app does when it sees something' }] },
    { type: 'orderedList', attrs: { start: 1 }, content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Motion opens a short assessment window.' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A person lingering or approaching escalates to a threat clip.' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The clip is saved locally and, on Premium, backed up to Drive.' }] }] },
    ] },
    { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The best parking clip is the one you never need to watch.' }] }] },
    { type: 'codeBlock', attrs: { language: 'text' }, content: [{ type: 'text', text: 'Settings → Parking Guard → Sensitivity: Medium\nSettings → Power → Stop below 12.1 V' }] },
    { type: 'horizontalRule' },
    { type: 'paragraph', content: [
      { type: 'text', text: 'Questions? ' },
      { type: 'text', text: 'Email support', marks: [{ type: 'link', attrs: { href: 'mailto:support@phonedashcam.com' } }] },
      { type: 'text', text: ' or try the ' },
      { type: 'text', text: 'unsafe link', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
      { type: 'text', text: ' that should render as plain text. <script>alert("xss")</script>' },
    ] },
  ],
};

const cardOf = (p) => ({
  slug: p.slug,
  title: p.title,
  description: p.description,
  firstPublishedAt: p.firstPublishedAt,
  lastPublishedAt: p.modifiedAt,
  image: p.titleFile ? { fileKey: p.titleFile.fileKey, alt: p.titleFile.altText, title: p.titleFile.title, caption: p.titleFile.caption } : null,
  category: p.category,
  author: p.author,
  tags: p.tags,
});

export const fullPosts = [
  {
    slug: 'parking-mode-on-a-phone-dash-cam',
    title: 'Parking mode on a phone dash cam: power, mounting, and settings',
    description: 'How to leave a phone recording overnight without a dead battery in the morning.',
    metaTitle: null,
    metaDescription: 'Set up parking mode on an Android phone dash cam: OBD power with a voltage cutoff, windshield mounting, and the sensitivity settings that avoid false alerts.',
    titleFile: { fileKey: 'posts/parking-mode/hero.jpg', altText: 'Phone mounted behind a rear-view mirror at night', title: null, caption: 'A phone on a magnetic mount, running parking mode.' },
    firstPublishedAt: '2026-09-01T12:00:00.000Z',
    modifiedAt: '2026-09-10T09:30:00.000Z',
    images: [],
    author,
    faqs: [
      { question: 'Does parking mode drain the car battery?', answer: 'Only if the phone is powered from a socket with no cutoff. An OBD cable with a voltmeter stops charging before the car cannot start.' },
      { question: 'Will it work with the screen off?', answer: 'Yes. DriveSight keeps recording with the screen dimmed to protect the panel and save power.' },
    ],
    category: categories[0],
    tags: [tags[0], tags[1]],
    content: doc,
  },
  {
    slug: 'deer-season-driving-what-a-dash-cam-sees-first',
    title: 'Deer season driving: what a dash cam sees before you do',
    description: 'Why on-device detection catches deer at the edge of the road a second or two before a driver reacts.',
    metaTitle: 'Deer detection on a phone dash cam | DriveSight',
    metaDescription: 'How DriveSight spots deer at the roadside with on-device AI, and how to drive when it warns you.',
    titleFile: null,
    firstPublishedAt: '2026-08-20T08:00:00.000Z',
    modifiedAt: '2026-08-20T08:00:00.000Z',
    images: [],
    author,
    faqs: null,
    category: categories[1],
    tags: [tags[2]],
    content: { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Deer strikes peak from October to December. A dash cam running detection gives you a warning while the animal is still on the shoulder.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What to do when you get an alert' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Brake in a straight line. Do not swerve into oncoming traffic or off the shoulder.' }] },
    ] },
  },
  {
    slug: 'turn-an-old-android-into-a-dash-cam-in-ten-minutes',
    title: 'Turn an old Android into a dash cam in ten minutes',
    description: 'The shortest path from a drawer phone to a working dash cam.',
    metaTitle: null,
    metaDescription: null,
    titleFile: { fileKey: 'posts/old-phone/hero.jpg', altText: 'An older Android phone on a dashboard mount', title: null, caption: null },
    firstPublishedAt: '2026-07-14T15:00:00.000Z',
    modifiedAt: '2026-07-14T15:00:00.000Z',
    images: [],
    author: null,
    faqs: [],
    category: categories[0],
    tags: [tags[1]],
    content: { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Factory reset it, install DriveSight, and mount it. That is most of the job.' }] },
    ] },
  },
];

export const posts = fullPosts.map(cardOf);

export const routes = [
  { type: 'home', slug: '', lastModified: '2026-09-10T09:30:00.000Z' },
  ...fullPosts.map((p) => ({ type: 'post', slug: p.slug, lastModified: p.modifiedAt })),
  ...categories.map((c) => ({ type: 'category', slug: c.slug, lastModified: '2026-09-10T09:30:00.000Z' })),
  { type: 'author', slug: author.slug, lastModified: '2026-09-10T09:30:00.000Z' },
  ...tags.map((t) => ({ type: 'tag', slug: t.slug, lastModified: '2026-09-10T09:30:00.000Z' })),
];

export const categorySummaries = categories.map((c) => ({
  slug: c.slug,
  title: c.name,
  description: c.description,
  imageUrl: null,
  posts: posts.filter((p) => p.category?.slug === c.slug).slice(0, 5),
}));

export const tagSummaries = tags.map((t) => ({
  slug: t.slug,
  name: t.name,
  description: null,
  postCount: posts.filter((p) => p.tags.some((x) => x.slug === t.slug)).length,
}));

export const authorsResponse = {
  type: 'authors',
  data: [{
    name: author.name,
    slug: author.slug,
    image: { fileKey: author.fileKey, alt: author.name, title: null, caption: null },
    bio: author.bio,
    posts: posts.filter((p) => p.author?.slug === author.slug),
  }],
};

export const rssItems = posts.map((p) => ({
  slug: p.slug,
  title: p.title,
  description: p.description,
  date: p.firstPublishedAt,
  categories: p.category ? [p.category.name] : [],
}));
