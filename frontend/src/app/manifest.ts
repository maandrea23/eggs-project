import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Brianna Eggs Farm Manager",
    short_name: "Brianna Eggs",
    description:
      "Mobile-first poultry farm management app for a one-coop egg farm.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f2ea",
    theme_color: "#23382f",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
