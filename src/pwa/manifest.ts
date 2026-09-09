export const webAppManifest = {
  name: "StudyDesk — Reading Room Manager",
  short_name: "StudyDesk",
  description:
    "Manage seats, members, monthly fees and renewals for a self-study library.",
  id: "./",
  start_url: "./",
  scope: "./",
  display: "standalone" as const,
  background_color: "#f4f6f2",
  theme_color: "#334155",
  orientation: "any" as const,
  lang: "en-IN",
  dir: "ltr" as const,
  categories: ["business", "productivity"],
  prefer_related_applications: false,
  icons: [
    {
      src: "icons/studydesk-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any" as const,
    },
    {
      src: "icons/studydesk-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any" as const,
    },
    {
      src: "icons/studydesk-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable" as const,
    },
  ],
};
