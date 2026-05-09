import type { Hono } from "hono";
import type { StudioApiAdapter } from "../types.js";

export function registerRegistryRoutes(app: Hono, adapter: StudioApiAdapter): void {
  app.get("/registry/blocks/:name/files/:file", async (c) => {
    const { name, file } = c.req.param();

    if (!/^[a-z0-9-]+$/.test(name) || !/^[a-z0-9-]+\.html$/.test(file)) {
      return c.json({ error: "Invalid block or file name" }, 400);
    }

    if (!adapter.readRegistryBlockFile) {
      return c.json({ error: "Registry not available" }, 501);
    }

    const content = await adapter.readRegistryBlockFile(name, file);
    if (content === null) {
      return c.json({ error: "Block file not found" }, 404);
    }

    return c.json({ content });
  });
}
