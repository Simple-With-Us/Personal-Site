import { publicCatalog } from "@/lib/public-catalog";

export type Project = {
  key: string;
  name: string;
  blurb: string;
  primaryHref: string;
  primaryLabel: "Visit website" | "View app" | "View source" | "View archived source";
  sourceHref?: string;
  category: "Coding" | "Financial" | "Utility";
  icon?: string;
  editions?: readonly { name: string; href: string; icon: string }[];
};

export const site = {
  name: "Jay Wedgeworth",
  /** Legal / formal name for Terms and formal docs */
  legalName: "John Wedgeworth Ⅳ (aka Jay Wedgeworth)",
  entity: "John Wedgeworth Ⅳ (aka Jay Wedgeworth)",
  title: "Developer • Modeler • Trader",
  location: "Houston, TX",
  email: "mail@jays.services",
  /** Primary domain (also served on jaywedgeworth.com) */
  domain: "jays.services",
  domains: ["jays.services", "jaywedgeworth.com"] as const,
  ogImage:
    "https://cdn.myportfolio.com/b0e28c58-4665-4144-92af-be86ffe7c576/580ae635-0852-46ab-93a9-0b63612c9488_rwc_0x0x1289x864x1289.png?h=ee5eb6a7bc277f48f2c0c473556d4d06",
  tagline: "Building software for AI workflows, markets, and everyday tasks.",
  about: [
    "I build software for market analysis, AI workflows, usage monitoring, and everyday utilities.",
    "Earlier work included 3D photogrammetry, aerial videography, managing construction projects with a SpaceX contractor, municipal lobbying and government relations, VoIP communication, and assisting the Visual Impairment and Intracranial Pressure team at NASA.",
    "Studied medicine at UTHealth San Antonio School of Medicine and UTRGV, public health at UTHealth Houston and George Washington University, and biochemistry at Baylor University.",
  ],
  social: [
    { id: "github", label: "GitHub", href: "https://github.com/jaywedgeworth22" },
    { id: "linkedin", label: "LinkedIn", href: "https://linkedin.com/in/JayWedgeworth" },
    {
      id: "doximity",
      label: "Doximity",
      href: "https://www.doximity.com/profiles/3cb95815-2fd1-4985-94e5-3d6f932283bf/view",
    },
    { id: "sketchfab", label: "Sketchfab", href: "https://sketchfab.com/Spaceport3D" },
    { id: "vimeo", label: "Vimeo", href: "http://vimeo.com/Advocacy" },
    { id: "facebook", label: "Facebook", href: "https://facebook.com/JayWedgeworth" },
    { id: "instagram", label: "Instagram", href: "https://instagram.com/JayWedgeworth" },
    { id: "x", label: "X", href: "https://x.com/JayWedgeworth" },
    { id: "youtube", label: "YouTube", href: "https://www.youtube.com/spaceport3d" },
    { id: "simplewithus", label: "Simple With Us", href: "https://simplewithus.com" },
    { id: "email", label: "Email", href: "mailto:mail@jays.services" },
  ],
  projects: [
    {
      key: "cc",
      name: "CodeCaps",
      blurb: "Track AI plan quotas, pacing meters, and reset windows from the Mac menu bar and iPhone.",
      primaryHref: publicCatalog.pages.codeCaps,
      primaryLabel: "View app",
      sourceHref: "https://github.com/Simple-With-Us/CodeCaps",
      category: "Coding",
      icon: "/app-icons/cc.png",
    },
    {
      key: "um",
      name: "Usage Monitor",
      blurb: "Check provider usage through a self-hosted server or directly on iPhone.",
      primaryHref: publicCatalog.websites.usageMonitor,
      primaryLabel: "Visit website",
      sourceHref: "https://github.com/Simple-With-Us/Usage-Monitor",
      category: "Coding",
      editions: [
        { name: "Client", href: publicCatalog.pages.usageClient, icon: "/app-icons/usage-client.png" },
        { name: "Local", href: publicCatalog.pages.usageLocal, icon: "/app-icons/usage-local.png" },
      ],
    },
    {
      key: "ck",
      name: "Clutch",
      blurb: "Run a local coding agent with DeepSeek and MiniMax support on Mac and iPhone.",
      primaryHref: publicCatalog.websites.clutch,
      primaryLabel: "Visit website",
      sourceHref: "https://github.com/Simple-With-Us/Clutch",
      category: "Coding",
      icon: "/app-icons/ck.svg",
    },
    {
      key: "bf",
      name: "BotFleet",
      blurb: "Run and inspect AI bots from one workspace.",
      primaryHref: publicCatalog.websites.botfleet,
      primaryLabel: "Visit website",
      sourceHref: "https://github.com/Simple-With-Us/BotFleet",
      category: "Coding",
      icon: "/app-icons/bf.png",
    },
    {
      key: "st",
      name: "Socratic Trade",
      blurb: "Review AI-generated trading proposals and manage broker execution.",
      primaryHref: publicCatalog.websites.socraticTrade,
      primaryLabel: "Visit website",
      sourceHref: "https://github.com/Simple-With-Us/Socratic-Trade",
      category: "Financial",
      icon: "/app-icons/st.png",
    },
    {
      key: "ct",
      name: "Congress.Trade",
      blurb: "Explore public trading disclosures and inspect source filings.",
      primaryHref: publicCatalog.websites.congressTrade,
      primaryLabel: "Visit website",
      sourceHref: "https://github.com/Simple-With-Us/Congress.Trade",
      category: "Financial",
      icon: "/app-icons/ct.png",
    },
    {
      key: "dd",
      name: "DealDex",
      blurb: "Compare Pokémon card listing prices on eBay and Mercari against TCGPlayer market values.",
      primaryHref: publicCatalog.websites.dealDex,
      primaryLabel: "Visit website",
      sourceHref: "https://github.com/Simple-With-Us/DealDex",
      category: "Utility",
      icon: "/app-icons/dd.png",
    },
    {
      key: "cl",
      name: "ContactLogo",
      blurb: "Review suggested company logos before applying them to contacts.",
      primaryHref: publicCatalog.websites.contactLogo,
      primaryLabel: "Visit website",
      sourceHref: "https://github.com/Simple-With-Us/ContactLogo",
      category: "Utility",
      icon: "/app-icons/cl.png",
    },
    {
      key: "ar",
      name: "Autorotate",
      blurb: "Retired.  Credential rotation is now handled natively by Infisical.",
      primaryHref: publicCatalog.pages.autorotate,
      primaryLabel: "View app",
      sourceHref: "https://github.com/Simple-With-Us/Autorotate",
      category: "Utility",
      icon: "/app-icons/ar.png",
    },
    {
      key: "hh",
      name: "HogHunter",
      blurb: "Track Mac CPU and memory hogs now, past hour, and past 24 hours, with iPhone companion.",
      primaryHref: publicCatalog.pages.hogHunter,
      primaryLabel: "View app",
      sourceHref: "https://github.com/Simple-With-Us/HogHunter",
      category: "Utility",
      icon: "/app-icons/hh.png",
    },
  ] satisfies Project[],
  appIcons: {
    ST: "/app-icons/st.png",
    CT: "/app-icons/ct.png",
    UM: "/app-icons/um.png",
    DD: "/app-icons/dd.png",
    AR: "/app-icons/ar.png",
    CL: "/app-icons/cl.png",
    PS: "/app-icons/ps.png",
    CC: "/app-icons/cc.png",
    MM: "/app-icons/mm.png",
    CK: "/app-icons/ck.svg",
    // HR is the retired Harness code.  Old digest lines still carry it, and
    // Harness is the same app as Clutch, so it shows the Clutch icon too.
    HR: "/app-icons/ck.svg",
    HH: "/app-icons/hh.png",
    FL: "/app-icons/fl.png",
    CTS: "/app-icons/fleet.png",
    AFC: "/app-icons/fleet.png",
    BF: "/app-icons/bf.png",
    fleet: "/app-icons/fleet.png",
  } as const,
  catalog: publicCatalog,
  media: {
    sketchfab:
      "https://sketchfab.com/models/33cd23b2245b422e926b37d2172e3e4e/embed",
    sketchfabModel:
      "https://sketchfab.com/3d-models/south-texas-launch-site-with-sn15-33cd23b2245b422e926b37d2172e3e4e",
    youtube: "https://www.youtube.com/embed/GkrkEgaQqcg",
  },
  fleet: {
    html: "https://jaywedgeworth22.github.io/AI-Fleet-Coordinator/",
    markdown: "https://jaywedgeworth22.github.io/AI-Fleet-Coordinator/digest.md",
    icsDaily:
      "https://jaywedgeworth22.github.io/AI-Fleet-Coordinator/calendar/daily-digest.ics",
    icsCommits:
      "https://jaywedgeworth22.github.io/AI-Fleet-Coordinator/calendar/agent-activity.ics",
  },
} as const;

export type SocialId = (typeof site.social)[number]["id"];
