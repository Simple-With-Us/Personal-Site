import { publicCatalog } from "@/lib/public-catalog";

export type Project = {
  key: string;
  name: string;
  blurb: string;
  primaryHref: string;
  primaryLabel: "Open" | "Details";
  sourceHref: string;
  tags: readonly string[];
  icon?: string;
  acronym?: string;
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
    "I build software for market analysis, AI workflows, API usage, and coordination tools.",
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
      key: "st",
      name: "Socratic Trade",
      blurb:
        "Review AI-generated trading proposals and manage execution with your broker.  Live at SocraticTrade.com.",
      primaryHref: publicCatalog.websites.socraticTrade,
      primaryLabel: "Open",
      sourceHref: "https://github.com/jaywedgeworth22/Socratic.Trade",
      tags: ["Markets", "Trading", "Web"],
      icon: "/app-icons/st.png",
      acronym: "ST",
    },
    {
      key: "ct",
      name: "Congress.Trade",
      blurb:
        "Explore public trading disclosures, filter by person, company, and filing date, then inspect the source.  Live at Congress.Trade.",
      primaryHref: publicCatalog.websites.congressTrade,
      primaryLabel: "Open",
      sourceHref: "https://github.com/jaywedgeworth22/Congress.Trade",
      tags: ["Markets", "Disclosures", "Web"],
      icon: "/app-icons/ct.png",
      acronym: "CT",
    },
    {
      key: "um",
      name: "Usage Monitor",
      blurb:
        "Review provider usage, balances, and costs from a server-backed dashboard.  Details and platform availability are listed in Simple With Us.",
      primaryHref: publicCatalog.pages.usageClient,
      primaryLabel: "Details",
      sourceHref: "https://github.com/jaywedgeworth22/Usage-Monitor",
      tags: ["Usage", "Costs", "Dashboard"],
      icon: "/app-icons/um.png",
      acronym: "UM",
    },
    {
      key: "dd",
      name: "DealDex.net",
      blurb:
        "Compare collectible card prices across marketplaces and inspect the sources.  Live at DealDex.net.",
      primaryHref: publicCatalog.websites.dealDex,
      primaryLabel: "Open",
      sourceHref: "https://github.com/jaywedgeworth22/DealDex",
      tags: ["Prices", "Sources", "Web"],
      icon: "/app-icons/dd.png",
      acronym: "DD",
    },
    {
      key: "cl",
      name: "ContactLogo",
      blurb:
        "Recognize business contacts at a glance, then review suggested logos before applying them.  Live at ContactLogo.com.",
      primaryHref: publicCatalog.websites.contactLogo,
      primaryLabel: "Open",
      sourceHref: "https://github.com/jaywedgeworth22/ContactLogo",
      tags: ["Contacts", "Review", "Web"],
      icon: "/app-icons/cl.png",
      acronym: "CL",
    },
    {
      key: "bf",
      name: "BotFleet.app",
      blurb:
        "Run your AI bots from one workspace.  Explore BotFleet.app for current platform availability.",
      primaryHref: publicCatalog.websites.botfleet,
      primaryLabel: "Open",
      sourceHref: "https://github.com/jaywedgeworth22/BotFleet",
      tags: ["AI", "Workspace", "Web"],
      icon: "/app-icons/bf.png",
      acronym: "BF",
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
    HR: "/app-icons/hr.png",
    HH: "/app-icons/hh.png",
    CTS: "/app-icons/fleet.png",
    AFC: "/app-icons/fleet.png",
    BF: "/app-icons/bf.png",
    fleet: "/app-icons/fleet.png",
  } as const,
  catalog: publicCatalog,
  media: {
    sketchfab:
      "https://sketchfab.com/models/33cd23b2245b422e926b37d2172e3e4e/embed",
    youtube: "https://www.youtube.com/embed/GkrkEgaQqcg",
  },
  fleet: {
    html: "https://jaywedgeworth22.github.io/ai-fleet-coordinator/",
    markdown: "https://jaywedgeworth22.github.io/ai-fleet-coordinator/digest.md",
    icsDaily:
      "https://jaywedgeworth22.github.io/ai-fleet-coordinator/calendar/daily-digest.ics",
    icsCommits:
      "https://jaywedgeworth22.github.io/ai-fleet-coordinator/calendar/agent-activity.ics",
  },
} as const;

export type SocialId = (typeof site.social)[number]["id"];
