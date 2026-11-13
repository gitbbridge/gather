"use client";

import dynamic from "next/dynamic";

const AuctionApp = dynamic(() => import("@/app/auction-app"), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen bg-[#f8faf9]" aria-busy="true" />
  ),
});

export default AuctionApp;
