/**
 * XPostAgent Logger
 * 統一されたログ出力ユーティリティ
 */

const LOG_PREFIX = '[XPostAgent]';

const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// 設定（開発時はDEBUG、本番はINFO以上）
const Config = {
  DEBUG_MODE: true,
  LOG_LEVEL: LogLevel.DEBUG,
};

const Logger = {
  /**
   * デバッグログ
   */
  debug: (component, action, data = {}) => {
    if (Config.DEBUG_MODE && Config.LOG_LEVEL <= LogLevel.DEBUG) {
      console.log(`${LOG_PREFIX}[DEBUG][${component}] ${action}`, data);
    }
  },

  /**
   * 情報ログ
   */
  info: (component, action, data = {}) => {
    if (Config.LOG_LEVEL <= LogLevel.INFO) {
      console.info(`${LOG_PREFIX}[INFO][${component}] ${action}`, data);
    }
  },

  /**
   * 警告ログ
   */
  warn: (component, action, data = {}) => {
    if (Config.LOG_LEVEL <= LogLevel.WARN) {
      console.warn(`${LOG_PREFIX}[WARN][${component}] ${action}`, data);
    }
  },

  /**
   * エラーログ
   */
  error: (component, action, error = {}) => {
    if (Config.LOG_LEVEL <= LogLevel.ERROR) {
      console.error(`${LOG_PREFIX}[ERROR][${component}] ${action}`, {
        message: error.message || error,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
    }
  },

  /**
   * 詳細エラーログ（コンテキスト付き）
   */
  detailedError: (component, action, error, context = {}) => {
    console.error(`${LOG_PREFIX}[ERROR][${component}] ${action}`, {
      message: error.message || error,
      stack: error.stack,
      context: {
        url: typeof window !== 'undefined' ? window.location.href : 'N/A',
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
        ...context,
      },
    });
  },

  /**
   * ログレベル設定
   */
  setLogLevel: (level) => {
    Config.LOG_LEVEL = level;
  },

  /**
   * デバッグモード設定
   */
  setDebugMode: (enabled) => {
    Config.DEBUG_MODE = enabled;
  },
};

// グローバルに公開（Content Script用）
if (typeof window !== 'undefined') {
  window.XPostAgentLogger = Logger;
}

// ES Module エクスポート（Background用）
if (typeof globalThis !== 'undefined') {
  globalThis.XPostAgentLogger = Logger;
}
