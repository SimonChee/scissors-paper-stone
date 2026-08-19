import { createFileRoute } from "@tanstack/react-router";

import { ShowdownGame } from "@/components/game/ShowdownGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Saloon Showdown — 7-Round Scissors Paper Stone" },
      {
        name: "description",
        content:
          "A two-player Wild West Scissors Paper Stone duel: flashing choices, hit Stop to lock in, seven rounds to crown a champion.",
      },
      { property: "og:title", content: "Saloon Showdown — 7-Round Scissors Paper Stone" },
      {
        property: "og:description",
        content:
          "Flashing choices, saloon piano, and seven rounds of Scissors Paper Stone for two players.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <ShowdownGame />;
}
