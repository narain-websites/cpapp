import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.chawlaplywood.app",
  appName: "Chawla Plywood",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    Camera: {
      permissions: ["camera", "photos"],
    },
  },
};

export default config;
