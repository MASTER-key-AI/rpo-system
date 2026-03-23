import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

function getDbClient(): DbClient {
    const { env } = getCloudflareContext() as { env: { DB?: D1Database } };

    if (!env.DB) {
        throw new Error("D1 binding `DB` is missing from the Cloudflare environment.");
    }

    return drizzle(env.DB, { schema });
}

// リクエスト単位で現在のCloudflareコンテキストからD1を解決する
export const db = new Proxy({} as DbClient, {
    get(_target, prop, receiver) {
        const client = getDbClient();
        const value = Reflect.get(client as object, prop, receiver);
        return typeof value === "function" ? value.bind(client) : value;
    },
});

export { schema };
