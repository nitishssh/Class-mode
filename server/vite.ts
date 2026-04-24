import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";
import { nanoid } from "nanoid";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const { createServer: createViteServer, createLogger } = await import("vite");
  const viteLogger = createLogger();

  const serverOptions = {
    middlewareMode: true as const,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    server: serverOptions,
    appType: "custom",
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(__dirname, "..", "client", "index.html");

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${nanoid()}"`);
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  console.log(`[serveStatic] Looking for static files in: ${distPath}`);
  console.log(`[serveStatic] __dirname is: ${__dirname}`);

  if (!fs.existsSync(distPath)) {
    console.error(`[serveStatic] ERROR: Build directory not found at ${distPath}`);
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  console.log(`[serveStatic] Found build directory, listing contents:`);
  try {
    const files = fs.readdirSync(distPath);
    console.log(`[serveStatic] Files in ${distPath}:`, files.slice(0, 10));
  } catch (e) {
    console.error(`[serveStatic] Error reading directory:`, e);
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    console.log(`[serveStatic] Serving index.html from: ${indexPath}`);
    res.sendFile(indexPath);
  });
}
