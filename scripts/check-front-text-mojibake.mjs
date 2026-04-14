import { readFileSync } from 'node:fs';

const checks = [
  {
    file: 'components/layout/NexusChat.tsx',
    snippets: [
      '褰撳墠鎬濊€?',
      '榛樿妯″瀷鍚屾澶辫触',
      '澶嶅埗澶辫触',
    ],
  },
  {
    file: 'components/chat/ChatMessage.tsx',
    snippets: [
      '姝ｅ湪鍔犺浇鍙鍖栨覆鏌撳櫒...',
      '鏃犺繑鍥炵粨鏋',
      '璋冪敤涓',
      '鎴愬姛',
      '澶辫触',
      '閿欒',
      '姝ｅ湪绛夊緟宸ュ叿杩斿洖缁撴灉...',
      '宸ュ叿璋冪敤澶辫触',
      '杩斿洖鍐呭',
      '澶嶅埗',
      '閲嶆柊鐢熸垚',
    ],
  },
  {
    file: 'components/chat/MarkdownContent.tsx',
    snippets: [
      '姝ｅ湪鍔犺浇 Mermaid 娓叉煋鍣?..',
      '姝ｅ湪鍔犺浇鍥捐〃娓叉煋鍣?..',
      '姝ｅ湪鍔犺浇 HTML 棰勮...',
    ],
  },
  {
    file: 'components/chat/HtmlCodeBlock.tsx',
    snippets: [
      '鏃犳硶鎵撳紑鏂扮獥鍙ｏ紝璇峰厑璁告湰绔欏脊鍑虹獥鍙',
      '鏂扮獥鍙ｉ瑙',
      '娌欑棰勮',
      'HTML 娌欑棰勮',
      '鍦?iframe 娌欑涓繍琛',
    ],
  },
  {
    file: 'components/chat/VisualizationBlock.tsx',
    snippets: [
      '鍏滃簳灞曠ず',
      '鍥捐〃娑堟伅鏃犳晥',
      '鍥捐〃娓叉煋澶辫触',
    ],
  },
];

const failures = [];

for (const check of checks) {
  const source = readFileSync(check.file, 'utf8');
  for (const snippet of check.snippets) {
    if (source.includes(snippet)) {
      failures.push(`${check.file}: ${snippet}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Found mojibake in user-facing frontend strings:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('No known mojibake found in user-facing frontend strings.');
