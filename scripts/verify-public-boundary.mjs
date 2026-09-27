import { access, readFile, readdir } from "node:fs/promises";

const roots = [
  new URL("../site/src/", import.meta.url),
  new URL("../site/public/", import.meta.url),
];
const textExtensions = new Set([".css", ".html", ".json", ".js", ".md", ".svg", ".ts", ".tsx"]);

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
const projectKeys = [...siteSource.matchAll(/\bkey: "([^"]+)"/g)].map((match) => match[1]);
const expectedProjectKeys = ["cc", "um", "hr", "mm", "bf", "st", "ct", "dd", "cl", "ar", "hh"];
if (projectKeys.length !== expectedProjectKeys.length ||
    expectedProjectKeys.some((key) => !projectKeys.includes(key))) {
  throw new Error(`public app families differ from the approved roster: ${projectKeys.join(", ")}`);
}

if (!siteSource.includes("publicCatalog.pages.usageClient") ||
    !siteSource.includes("publicCatalog.pages.usageLocal") ||
    !siteSource.includes("/app-icons/usage-client.png") ||
    !siteSource.includes("/app-icons/usage-local.png")) {
  throw new Error("Usage Monitor must show its Client and Local editions separately");
}

if (!homeSource.includes("projectCategories.map") ||
    !["Coding", "Financial", "Utility"].every((category) => siteSource.includes(`category: "${category}"`))) {
  throw new Error("public apps must be grouped under Coding, Financial, and Utility");
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

const sketchfabModelUrl =
  "https://sketchfab.com/3d-models/south-texas-launch-site-with-sn15-33cd23b2245b422e926b37d2172e3e4e";
if (!siteSource.includes(sketchfabModelUrl) || !homeSource.includes("site.media.sketchfabModel")) {
  throw new Error("Sketchfab links should use the specific model destination");
}

if (!activitySource.includes('section.kind !== "effort"')) {
  throw new Error("internal effort-board activity must stay out of the public view");
}

for (const match of catalogSource.matchAll(/:\s*\"(https:\/\/[^\"]+)\"/g)) {
  new URL(match[1]);
}

for (const path of [
  "../site/public/app-icons/st.png",
  "../site/public/app-icons/usage-client.png",
  "../site/public/app-icons/usage-local.png",
  "../site/public/app-icons/hr.svg",
  "../site/public/brand/simple-with-us-wide.png",
  "../site/public/brand/simple-with-us-square.png",
]) {
  await access(new URL(path, import.meta.url));
}

if (!homeSource.includes("/brand/simple-with-us-wide.png") ||
    !siteSource.includes('icon: "/app-icons/hr.svg"') ||
    siteSource.includes("/app-icons/hr.png")) {
  throw new Error("Simple With Us and Harness branding regressed");
}

console.log("public portfolio boundary checks passed");
