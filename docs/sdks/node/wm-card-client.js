/**
 * WM Card OpenAPI Node.js 客户端示例
 * 依赖：Node 18+（内置 fetch）
 * 无需额外 npm install
 */

const BASE_URL = "https://winmelon.cn/open/v1";

export class WmCardClient {
  /**
   * @param {string} apiKey  sk_live_ 开头的商户 API Key
   * @param {{ timeout?: number }} [options]
   */
  constructor(apiKey, options = {}) {
    if (!apiKey || !apiKey.startsWith("sk_live_")) {
      throw new Error("API Key 必须以 sk_live_ 开头");
    }
    this.apiKey = apiKey;
    this.timeout = options.timeout ?? 30_000;
  }

  /**
   * @param {string} method
   * @param {string} path
   * @param {{ query?: Record<string, any>, body?: any }} [opts]
   */
  async _request(method, path, opts = {}) {
    const url = new URL(`${BASE_URL}${path}`);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    const maxRetries = 3;
    let lastErr;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      try {
        const resp = await fetch(url, {
          method,
          headers: {
            "X-API-Key": this.apiKey,
            "Content-Type": "application/json",
            "User-Agent": "wm-card-node/1.0",
          },
          body: opts.body ? JSON.stringify(opts.body) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (resp.status === 429 || resp.status >= 500) {
          if (attempt < maxRetries) {
            await sleep(2 ** attempt * 1000);
            continue;
          }
        }
        const json = await resp.json();
        if (json.code !== "OK") {
          throw new Error(`API 错误 [${resp.status}]: ${json.message} (requestId=${json.requestId})`);
        }
        return json.data;
      } catch (err) {
        clearTimeout(timer);
        lastErr = err;
        if (err.name === "AbortError" && attempt < maxRetries) {
          await sleep(2 ** attempt * 1000);
          continue;
        }
        throw err;
      }
    }
    throw lastErr ?? new Error("重试次数耗尽");
  }

  // ============== 商品 ==============

  /** @param {{ keyword?: string, status?: 'ONLINE'|'OFFLINE'|'SOLD_OUT', page?: number, pageSize?: number }} q */
  listProducts(q = {}) {
    return this._request("GET", "/products", { query: { page: 1, pageSize: 20, ...q } });
  }

  /** @param {string} id */
  getProduct(id) {
    return this._request("GET", `/products/${id}`);
  }

  /** @param {Record<string, any>} payload */
  createProduct(payload) {
    return this._request("POST", "/products", { body: payload });
  }

  /** @param {string} id @param {Record<string, any>} payload */
  updateProduct(id, payload) {
    return this._request("POST", `/products/${id}/update`, { body: payload });
  }

  // ============== 卡密 ==============

  /** @param {string} productId @param {{ status?: string, page?: number, pageSize?: number }} [q] */
  listStock(productId, q = {}) {
    return this._request("GET", "/stock", { query: { productId, page: 1, pageSize: 50, ...q } });
  }

  /**
   * 导入卡密
   * @param {string} productId
   * @param {string[]} cards 卡密字符串数组
   */
  importStock(productId, cards) {
    const csvContent = cards.map((c) => escapeCsv(c)).join("\n");
    return this._request("POST", "/stock/import", {
      body: { productId, csvContent },
    });
  }

  /** @param {string} productId */
  stockStats(productId) {
    return this._request("GET", `/stock/stats/${productId}`);
  }

  // ============== 订单 ==============

  /** @param {{ page?: number, pageSize?: number, status?: string }} [q] */
  listOrders(q = {}) {
    return this._request("GET", "/orders", { query: { page: 1, pageSize: 20, ...q } });
  }

  /** @param {string} id */
  getOrder(id) {
    return this._request("GET", `/orders/${id}`);
  }
}

function escapeCsv(value) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============== 使用示例 ==============

// const client = new WmCardClient("sk_live_REPLACE_ME");
//
// // 1. 列商品
// const products = await client.listProducts({ status: "ONLINE" });
// console.log(`在线商品: ${products.total} 个`);
//
// // 2. 导入卡密
// const result = await client.importStock("p_01J3X...", [
//   "ABC-DEF-001",
//   "ABC-DEF-002",
//   "ABC-DEF-003",
// ]);
// console.log(`导入: ${result.imported} 条`);
//
// // 3. 查订单
// const orders = await client.listOrders({ page: 1, pageSize: 10, status: "PAID" });
// for (const o of orders.items) {
//   console.log(`订单 ${o.id}: ${o.amount} 元`);
// }
