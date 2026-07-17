/** 站点运行时绑定；未启用的资源保持可选。 */
declare global {
  namespace Cloudflare {
    interface Env {
      DB?: D1Database;
    }
  }
}

export {};
