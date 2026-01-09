/**
 * XPostAgent API Client
 * Cloudflare Worker との通信
 */

const API_BASE_URL = 'https://xpostagent-worker.menu-simulator.workers.dev';

const ApiClient = {
  /**
   * ヘルスチェック
   */
  async health() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      return await response.json();
    } catch (error) {
      console.error('[XPostAgent][API] Health check failed:', error);
      throw error;
    }
  },

  /**
   * セレクタ取得
   * @param {string} action - 取得するカテゴリ（省略で全取得）
   */
  async getSelectors(action = null) {
    try {
      const body = action ? { action } : {};
      const response = await fetch(`${API_BASE_URL}/api/selectors/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return await response.json();
    } catch (error) {
      console.error('[XPostAgent][API] Get selectors failed:', error);
      throw error;
    }
  },

  /**
   * セレクタ検証
   * @param {string} currentDOM - 現在のDOM構造
   * @param {string} version - 現在のバージョン
   * @param {string[]} failedSelectors - 失敗したセレクタ
   */
  async validateSelectors(currentDOM, version, failedSelectors = []) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/selectors/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentDOM, version, failedSelectors }),
      });
      return await response.json();
    } catch (error) {
      console.error('[XPostAgent][API] Validate selectors failed:', error);
      throw error;
    }
  },

  /**
   * セルフヒーリング
   * @param {string} currentDOM - 現在のDOM構造
   * @param {string[]} failedSelectors - 失敗したセレクタ
   */
  async healSelectors(currentDOM, failedSelectors) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/selectors/heal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentDOM, failedSelectors }),
      });
      return await response.json();
    } catch (error) {
      console.error('[XPostAgent][API] Heal selectors failed:', error);
      throw error;
    }
  },
};

// グローバルに公開
if (typeof window !== 'undefined') {
  window.XPostAgentApi = ApiClient;
}

if (typeof globalThis !== 'undefined') {
  globalThis.XPostAgentApi = ApiClient;
}
