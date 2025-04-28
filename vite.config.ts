import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0", // Allows access from the network
    port: 5173, // Ensure it runs on the desired port
    strictPort: true, // Ensures the port doesn't change
  },
});
