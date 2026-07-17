#!/usr/bin/env python3
"""Add BreadcrumbList JSON-LD to pages missing it, matching existing site style."""
import glob, html, json, os, re, sys

os.chdir("/mnt/storage/Desktop/DriveSight/website")

SKIP = {
    "index.html",              # homepage — breadcrumb is pointless
    "privacy-policy.html",
    "gridwatch-privacy-policy.html",
    "google7a89df1449d9df77.html",
}

added, skipped = [], []
for path in sorted(glob.glob("*.html")):
    if path in SKIP:
        continue
    with open(path, encoding="utf-8") as f:
        text = f.read()
    if "BreadcrumbList" in text:
        continue

    m_canon = re.search(r'<link rel="canonical" href="([^"]+)"', text)
    m_title = re.search(r"<title>(.*?)</title>", text, re.S)
    if not m_canon or not m_title or "</head>" not in text:
        skipped.append(path)
        continue

    url = m_canon.group(1).rstrip("/")
    title = html.unescape(m_title.group(1).strip())
    # strip site-name suffixes like " | Phone Dashcam" / " - DriveSight"
    title = re.sub(r"\s*[|–-]\s*(Phone Dashcam|DriveSight)\s*$", "", title)

    crumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "DriveSight",
             "item": "https://phonedashcam.com"},
            {"@type": "ListItem", "position": 2, "name": title, "item": url},
        ],
    }
    block = (
        '<script type="application/ld+json">'
        + json.dumps(crumb, ensure_ascii=False, separators=(",", ":"))
        + "</script>\n"
    )
    text = text.replace("</head>", block + "</head>", 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    added.append(path)

print(f"Added breadcrumbs to {len(added)} pages")
for p in skipped:
    print(f"SKIPPED (missing canonical/title/head): {p}", file=sys.stderr)
