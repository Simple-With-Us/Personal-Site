import { readFile, readdir } from "node:fs/promises";

const roots = [
  new URL("../site/src/", import.meta.url),
  new URL("../site/public/", import.meta.url),
];
const textExtensions = new Set([".css", ".html", ".json", ".js", ".md", ".ts", ".tsx"]);

async function textFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const url = new URL(entry.name, root);
      if (entry.isDirectory()) return textFiles(new URL(`${entry.name}/`, root));
      const extension = entry.name.slice(entry.name.lastIndexOf("."));
      return textExtensions.has(extension) ? [url] : [];
    }),
  );
  return nested.flat();
}

const files = Object.fromEntries(
  [
    ...(await Promise.all(roots.map(textFiles))).flat(),
    new URL("../AGENTS.md", import.meta.url),
  ].map((url) => [url.pathname, url]),
);

const contents = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([name, url]) => [name, await readFile(url, "utf8")]),
  ),
);

const publicSource = Object.values(contents).join("\n");
const forbiddenPrivateDestinations = [
  /https?:\/\/github\.com\/jaywedgeworth22\/fleet-ops/i,
  /https?:\/\/(?:mac|board|control)\.jays\.services/i,
];

for (const pattern of forbiddenPrivateDestinations) {
  if (pattern.test(publicSource)) {
    throw new Error(`private destination found in public source: ${pattern}`);
  }
}

const siteSource =
  Object.entries(contents).find(([path]) => path.endsWith("/site/src/lib/site.ts"))?.[1] ?? "";
const homeSource =
  Object.entries(contents).find(([path]) => path.endsWith("/site/src/components/home-page.tsx"))?.[1] ?? "";
const activitySource =
  Object.entries(contents).find(([path]) => path.endsWith("/site/src/components/fleet-activity.tsx"))?.[1] ?? "";
const catalogSource =
  Object.entries(contents).find(([path]) => path.endsWith("/site/src/lib/public-catalog.ts"))?.[1] ?? "";
const projectCount = (siteSource.match(/\bkey: \"/g) ?? []).length;
if (projectCount !== 6) {
  throw new Error(`expected six selected projects, found ${projectCount}`);
}

if (!siteSource.includes("Earlier work included")) {
  throw new Error("required About work-history copy is missing");
}

if (/testflight\.apple\.com\/join/i.test(publicSource)) {
  throw new Error("portfolio source contains a duplicated TestFlight invite");
}

if (publicSource.includes("https://jaywedgeworth22.github.io/ai-fleet-coordinator")) {
  throw new Error("portfolio source contains the case-sensitive digest URL variant");
}

if (homeSource.includes("{p.primaryLabel} app")) {
  throw new Error("project CTA still appends an inaccurate generic suffix");
}

if (homeSource.includes('allow="autoplay; fullscreen; xr-spatial-tracking"')) {
  throw new Error("Sketchfab should not load with autoplay enabled");
}

if (!homeSource.includes("site.media.sketchfabModel")) {
  throw new Error("Sketchfab links should use the specific model destination");
}

if (!activitySource.includes('section.kind !== "effort"')) {
  throw new Error("internal effort-board activity must stay out of the public view");
}

for (const match of catalogSource.matchAll(/:\s*\"(https:\/\/[^\"]+)\"/g)) {
  new URL(match[1]);
}

console.log("public portfolio boundary checks passed");
