import { readFile } from "node:fs/promises";

const files = {
  site: new URL("../site/src/lib/site.ts", import.meta.url),
  catalog: new URL("../site/src/lib/public-catalog.ts", import.meta.url),
  home: new URL("../site/src/components/home-page.tsx", import.meta.url),
  start: new URL("../site/public/start/index.html", import.meta.url),
  agents: new URL("../AGENTS.md", import.meta.url),
};

const contents = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([name, url]) => [name, await readFile(url, "utf8")]),
  ),
);

const publicSource = `${contents.site}\n${contents.catalog}\n${contents.home}\n${contents.start}\n${contents.agents}`;
const forbiddenPrivateDestinations = [
  /https?:\/\/github\.com\/jaywedgeworth22\/fleet-ops/i,
  /https?:\/\/(?:mac|board|control)\.jays\.services/i,
];

for (const pattern of forbiddenPrivateDestinations) {
  if (pattern.test(publicSource)) {
    throw new Error(`private destination found in public source: ${pattern}`);
  }
}

const projectCount = (contents.site.match(/\bkey: \"/g) ?? []).length;
if (projectCount !== 6) {
  throw new Error(`expected six selected projects, found ${projectCount}`);
}

if (!contents.site.includes("Earlier work included")) {
  throw new Error("required About work-history copy is missing");
}

if (/testflight\.apple\.com\/join/i.test(publicSource)) {
  throw new Error("portfolio source contains a duplicated TestFlight invite");
}

for (const match of contents.catalog.matchAll(/:\s*\"(https:\/\/[^\"]+)\"/g)) {
  new URL(match[1]);
}

console.log("public portfolio boundary checks passed");
