/**
 * XPostAgent Selector Manager
 * DOM要素の検索・操作ユーティリティ
 */

const SelectorManager = {
  // キャッシュされたセレクタ
  _cache: null,
  _version: null,

  /**
   * セレクタをキャッシュに設定
   */
  setSelectors(selectors, version) {
    this._cache = selectors;
    this._version = version;
    console.log('[XPostAgent][Selectors] Cached selectors:', { version });
  },

  /**
   * キャッシュされたセレクタを取得
   */
  getSelectors() {
    return this._cache;
  },

  /**
   * バージョンを取得
   */
  getVersion() {
    return this._version;
  },

  /**
   * 要素を検索（プライマリ → フォールバック）
   * @param {Object} selectorDef - { primary: string, fallback: string[] }
   * @returns {{ element: Element|null, usedFallback: boolean, selector: string }}
   */
  findElement(selectorDef) {
    if (!selectorDef) {
      return { element: null, usedFallback: false, selector: null, error: 'No selector definition' };
    }

    // プライマリセレクタで検索
    let element = document.querySelector(selectorDef.primary);
    if (element) {
      return { element, usedFallback: false, selector: selectorDef.primary };
    }

    // フォールバックで検索
    const fallbacks = selectorDef.fallback || [];
    for (const fallback of fallbacks) {
      element = document.querySelector(fallback);
      if (element) {
        console.warn('[XPostAgent][Selectors] Using fallback selector:', fallback);
        return { element, usedFallback: true, selector: fallback };
      }
    }

    return { element: null, usedFallback: false, selector: null, error: 'Element not found' };
  },

  /**
   * 要素の出現を待機
   * @param {Object} selectorDef
   * @param {number} timeout - ミリ秒
   * @returns {Promise<Element>}
   */
  async waitForElement(selectorDef, timeout = 5000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = this.findElement(selectorDef);
      if (result.element) {
        return result.element;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Element not found within ${timeout}ms: ${JSON.stringify(selectorDef)}`);
  },

  /**
   * 複数の要素を一度に検索
   * @param {Object} selectorDefs - { name: selectorDef, ... }
   * @returns {Object} - { name: { element, found, usedFallback }, ... }
   */
  findElements(selectorDefs) {
    const results = {};
    const failed = [];

    for (const [name, def] of Object.entries(selectorDefs)) {
      const result = this.findElement(def);
      results[name] = {
        element: result.element,
        found: !!result.element,
        usedFallback: result.usedFallback,
        selector: result.selector,
      };
      if (!result.element) {
        failed.push(name);
      }
    }

    return { results, failed, allFound: failed.length === 0 };
  },

  /**
   * カテゴリからセレクタ定義を取得
   * @param {string} category - 'composer', 'media', 'options' など
   * @param {string} name - 'textArea', 'postButton' など
   */
  getSelectorDef(category, name) {
    if (!this._cache || !this._cache[category]) {
      return null;
    }
    return this._cache[category][name] || null;
  },
};

// グローバルに公開
if (typeof window !== 'undefined') {
  window.XPostAgentSelectors = SelectorManager;
}

if (typeof globalThis !== 'undefined') {
  globalThis.XPostAgentSelectors = SelectorManager;
}
