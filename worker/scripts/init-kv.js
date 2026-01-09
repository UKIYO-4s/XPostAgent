/**
 * KV 初期化スクリプト
 *
 * 使用方法:
 * 1. wrangler でログイン: wrangler login
 * 2. KV namespace を作成: wrangler kv:namespace create "SELECTORS"
 * 3. wrangler.toml の id を更新
 * 4. このスクリプトを実行: npm run kv:init
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 初期セレクタデータを読み込み
const selectorsPath = path.join(__dirname, 'initial-selectors.json');
const selectors = JSON.parse(fs.readFileSync(selectorsPath, 'utf8'));

// KV に保存するデータ
const kvData = [
  {
    key: 'selectors:current',
    value: JSON.stringify(selectors),
  },
  {
    key: `selectors:v${selectors.version}`,
    value: JSON.stringify(selectors),
  },
  {
    key: 'selectors:current:version',
    value: selectors.version,
  },
];

console.log('=== XPostAgent KV 初期化 ===\n');

// 各キーを保存
for (const item of kvData) {
  console.log(`Saving: ${item.key}`);

  // 一時ファイルに値を保存（長い値のため）
  const tempFile = path.join(__dirname, 'temp-value.json');
  fs.writeFileSync(tempFile, item.value);

  try {
    execSync(`wrangler kv:key put --binding SELECTORS "${item.key}" --path "${tempFile}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });
    console.log(`  ✓ Saved successfully\n`);
  } catch (error) {
    console.error(`  ✗ Failed to save: ${error.message}\n`);
  }

  // 一時ファイルを削除
  fs.unlinkSync(tempFile);
}

console.log('=== 初期化完了 ===');
console.log('\n確認コマンド:');
console.log('  wrangler kv:key list --binding SELECTORS');
console.log('  wrangler kv:key get --binding SELECTORS "selectors:current:version"');
