/**
 * Public link projection from Simple With Us `apps/index.json` (2026-09-26).  Availability and beta facts stay in the catalog manifest; this site only consumes verified public pages and product websites.
 */
export const publicCatalog = {
  root: "https://simplewithus.com/",
  pages: {
    botfleet: "https://simplewithus.com/botfleet/",
    contactLogo: "https://simplewithus.com/contactlogo/",
    congressTrade: "https://simplewithus.com/congress-trade/",
    dealDex: "https://simplewithus.com/dealdex/",
    socraticTrade: "https://simplewithus.com/socratic-trade/",
    usageClient: "https://simplewithus.com/usage-client/",
  },
  websites: {
    botfleet: "https://botfleet.app/",
    contactLogo: "https://contactlogo.com/",
    congressTrade: "https://congress.trade/",
    dealDex: "https://dealdex.net/",
    socraticTrade: "https://socratictrade.com/",
  },
} as const;
