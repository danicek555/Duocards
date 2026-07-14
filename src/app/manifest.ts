import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DuoCards",
    short_name: "DuoCards",
    description:
      "Create, organize, and learn languages with interactive AI flashcards.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6ff",
    theme_color: "#4f46e5",
    icons: [
      {
        src: "/duocards-app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/duocards-app-icon-1024.png",
        sizes: "1024x1024",
        type: "image/png",
      },
    ],
  };
}
