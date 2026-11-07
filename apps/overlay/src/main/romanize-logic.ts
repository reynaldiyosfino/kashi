/**
 * CJK romanization for overlay lyric lines.
 *
 * Order (Better Lyrics–compatible):
 *   1. Unison POST /translate (google-lyrics-translate) — real JP/KR/CN romaji
 *   2. Local fallback: Hangul RR; JP kana Hepburn (never pinyin on kana lines);
 *      CN Han → compact pinyin table. Mixed JP kanji without Unison hides the
 *      romaji row rather than showing leftover kanji / Chinese pinyin.
 *
 * LRCLIB has no romaji field — this layer always runs after a lyric hit.
 */

import {
  fetchUnisonRomanizations,
  needsUnisonRomanize,
  type UnisonFetch,
} from './unison-romanize.js';

const HIRA =
  'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをん';
const KATA =
  'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲン';

const KANA_ROMA: Record<string, string> = {
  あ: 'a',
  い: 'i',
  う: 'u',
  え: 'e',
  お: 'o',
  か: 'ka',
  き: 'ki',
  く: 'ku',
  け: 'ke',
  こ: 'ko',
  が: 'ga',
  ぎ: 'gi',
  ぐ: 'gu',
  げ: 'ge',
  ご: 'go',
  さ: 'sa',
  し: 'shi',
  す: 'su',
  せ: 'se',
  そ: 'so',
  ざ: 'za',
  じ: 'ji',
  ず: 'zu',
  ぜ: 'ze',
  ぞ: 'zo',
  た: 'ta',
  ち: 'chi',
  つ: 'tsu',
  て: 'te',
  と: 'to',
  だ: 'da',
  ぢ: 'ji',
  づ: 'zu',
  で: 'de',
  ど: 'do',
  な: 'na',
  に: 'ni',
  ぬ: 'nu',
  ね: 'ne',
  の: 'no',
  は: 'ha',
  ひ: 'hi',
  ふ: 'fu',
  へ: 'he',
  ほ: 'ho',
  ば: 'ba',
  び: 'bi',
  ぶ: 'bu',
  べ: 'be',
  ぼ: 'bo',
  ぱ: 'pa',
  ぴ: 'pi',
  ぷ: 'pu',
  ぺ: 'pe',
  ぽ: 'po',
  ま: 'ma',
  み: 'mi',
  む: 'mu',
  め: 'me',
  も: 'mo',
  や: 'ya',
  ゆ: 'yu',
  よ: 'yo',
  ら: 'ra',
  り: 'ri',
  る: 'ru',
  れ: 're',
  ろ: 'ro',
  わ: 'wa',
  を: 'o',
  ん: 'n',
  きゃ: 'kya',
  きゅ: 'kyu',
  きょ: 'kyo',
  ぎゃ: 'gya',
  ぎゅ: 'gyu',
  ぎょ: 'gyo',
  しゃ: 'sha',
  しゅ: 'shu',
  しょ: 'sho',
  じゃ: 'ja',
  じゅ: 'ju',
  じょ: 'jo',
  ちゃ: 'cha',
  ちゅ: 'chu',
  ちょ: 'cho',
  にゃ: 'nya',
  にゅ: 'nyu',
  にょ: 'nyo',
  ひゃ: 'hya',
  ひゅ: 'hyu',
  ひょ: 'hyo',
  びゃ: 'bya',
  びゅ: 'byu',
  びょ: 'byo',
  ぴゃ: 'pya',
  ぴゅ: 'pyu',
  ぴょ: 'pyo',
  みゃ: 'mya',
  みゅ: 'myu',
  みょ: 'myo',
  りゃ: 'rya',
  りゅ: 'ryu',
  りょ: 'ryo',
};

/** Frequent lyric Han → Hanyu Pinyin (no tone marks). CN-only path. */
const PINYIN: Record<string, string> = {
  一: 'yi',
  七: 'qi',
  万: 'wan',
  三: 'san',
  上: 'shang',
  下: 'xia',
  不: 'bu',
  与: 'yu',
  世: 'shi',
  东: 'dong',
  两: 'liang',
  个: 'ge',
  中: 'zhong',
  为: 'wei',
  主: 'zhu',
  久: 'jiu',
  之: 'zhi',
  乐: 'le',
  也: 'ye',
  了: 'le',
  事: 'shi',
  二: 'er',
  于: 'yu',
  云: 'yun',
  人: 'ren',
  什: 'shen',
  今: 'jin',
  从: 'cong',
  他: 'ta',
  以: 'yi',
  们: 'men',
  会: 'hui',
  伤: 'shang',
  你: 'ni',
  來: 'lai',
  来: 'lai',
  候: 'hou',
  做: 'zuo',
  像: 'xiang',
  兒: 'er',
  光: 'guang',
  全: 'quan',
  再: 'zai',
  冬: 'dong',
  冷: 'leng',
  几: 'ji',
  出: 'chu',
  分: 'fen',
  别: 'bie',
  到: 'dao',
  前: 'qian',
  力: 'li',
  化: 'hua',
  北: 'bei',
  十: 'shi',
  千: 'qian',
  半: 'ban',
  南: 'nan',
  去: 'qu',
  又: 'you',
  口: 'kou',
  只: 'zhi',
  可: 'ke',
  台: 'tai',
  右: 'you',
  叶: 'ye',
  号: 'hao',
  吃: 'chi',
  各: 'ge',
  同: 'tong',
  后: 'hou',
  向: 'xiang',
  听: 'ting',
  吹: 'chui',
  周: 'zhou',
  味: 'wei',
  和: 'he',
  哭: 'ku',
  啊: 'a',
  唱: 'chang',
  問: 'wen',
  喜: 'xi',
  嘿: 'hei',
  四: 'si',
  回: 'hui',
  因: 'yin',
  国: 'guo',
  圖: 'tu',
  在: 'zai',
  地: 'di',
  场: 'chang',
  声: 'sheng',
  夢: 'meng',
  夜: 'ye',
  大: 'da',
  天: 'tian',
  太: 'tai',
  头: 'tou',
  好: 'hao',
  如: 'ru',
  始: 'shi',
  子: 'zi',
  字: 'zi',
  孤: 'gu',
  学: 'xue',
  安: 'an',
  定: 'ding',
  实: 'shi',
  对: 'dui',
  将: 'jiang',
  小: 'xiao',
  就: 'jiu',
  尽: 'jin',
  山: 'shan',
  岁: 'sui',
  工: 'gong',
  己: 'ji',
  已: 'yi',
  巴: 'ba',
  带: 'dai',
  常: 'chang',
  年: 'nian',
  并: 'bing',
  幸: 'xing',
  幻: 'huan',
  幽: 'you',
  度: 'du',
  开: 'kai',
  当: 'dang',
  很: 'hen',
  得: 'de',
  心: 'xin',
  忘: 'wang',
  忙: 'mang',
  快: 'kuai',
  忽: 'hu',
  怎: 'zen',
  思: 'si',
  急: 'ji',
  性: 'xing',
  恋: 'lian',
  恩: 'en',
  情: 'qing',
  想: 'xiang',
  意: 'yi',
  愛: 'ai',
  爱: 'ai',
  感: 'gan',
  愿: 'yuan',
  成: 'cheng',
  我: 'wo',
  战: 'zhan',
  所: 'suo',
  手: 'shou',
  才: 'cai',
  打: 'da',
  找: 'zhao',
  把: 'ba',
  报: 'bao',
  抱: 'bao',
  抽: 'chou',
  拉: 'la',
  拍: 'pai',
  拥: 'yong',
  挥: 'hui',
  掉: 'diao',
  接: 'jie',
  推: 'tui',
  散: 'san',
  数: 'shu',
  新: 'xin',
  方: 'fang',
  旅: 'lv',
  无: 'wu',
  日: 'ri',
  旧: 'jiu',
  时: 'shi',
  明: 'ming',
  星: 'xing',
  春: 'chun',
  昨: 'zuo',
  是: 'shi',
  時: 'shi',
  晚: 'wan',
  晴: 'qing',
  暗: 'an',
  最: 'zui',
  月: 'yue',
  有: 'you',
  朋: 'peng',
  望: 'wang',
  朝: 'chao',
  末: 'mo',
  本: 'ben',
  東: 'dong',
  果: 'guo',
  梦: 'meng',
  欢: 'huan',
  歌: 'ge',
  正: 'zheng',
  此: 'ci',
  步: 'bu',
  死: 'si',
  每: 'mei',
  比: 'bi',
  气: 'qi',
  水: 'shui',
  永: 'yong',
  求: 'qiu',
  汉: 'han',
  没: 'mei',
  河: 'he',
  泪: 'lei',
  流: 'liu',
  海: 'hai',
  消: 'xiao',
  深: 'shen',
  清: 'qing',
  游: 'you',
  满: 'man',
  潮: 'chao',
  火: 'huo',
  点: 'dian',
  热: 're',
  爲: 'wei',
  父: 'fu',
  片: 'pian',
  物: 'wu',
  特: 'te',
  狂: 'kuang',
  独: 'du',
  猜: 'cai',
  玩: 'wan',
  生: 'sheng',
  用: 'yong',
  男: 'nan',
  画: 'hua',
  的: 'de',
  目: 'mu',
  直: 'zhi',
  相: 'xiang',
  看: 'kan',
  真: 'zhen',
  眼: 'yan',
  着: 'zhe',
  知: 'zhi',
  破: 'po',
  离: 'li',
  秋: 'qiu',
  空: 'kong',
  笑: 'xiao',
  等: 'deng',
  算: 'suan',
  粉: 'fen',
  紅: 'hong',
  红: 'hong',
  约: 'yue',
  线: 'xian',
  终: 'zhong',
  经: 'jing',
  结: 'jie',
  给: 'gei',
  绝: 'jue',
  继: 'ji',
  续: 'xu',
  网: 'wang',
  置: 'zhi',
  美: 'mei',
  翻: 'fan',
  老: 'lao',
  而: 'er',
  耳: 'er',
  聆: 'ling',
  背: 'bei',
  能: 'neng',
  脸: 'lian',
  自: 'zi',
  至: 'zhi',
  色: 'se',
  花: 'hua',
  苦: 'ku',
  若: 'ruo',
  英: 'ying',
  茫: 'mang',
  蓝: 'lan',
  行: 'xing',
  街: 'jie',
  衣: 'yi',
  表: 'biao',
  西: 'xi',
  要: 'yao',
  見: 'jian',
  见: 'jian',
  觉: 'jue',
  解: 'jie',
  言: 'yan',
  記: 'ji',
  记: 'ji',
  许: 'xu',
  论: 'lun',
  识: 'shi',
  说: 'shuo',
  请: 'qing',
  谁: 'shui',
  调: 'diao',
  谢: 'xie',
  走: 'zou',
  起: 'qi',
  超: 'chao',
  越: 'yue',
  路: 'lu',
  身: 'shen',
  车: 'che',
  转: 'zhuan',
  轻: 'qing',
  边: 'bian',
  过: 'guo',
  近: 'jin',
  还: 'hai',
  这: 'zhe',
  进: 'jin',
  远: 'yuan',
  连: 'lian',
  迷: 'mi',
  追: 'zhui',
  退: 'tui',
  送: 'song',
  逃: 'tao',
  透: 'tou',
  這: 'zhe',
  通: 'tong',
  逝: 'shi',
  遇: 'yu',
  遊: 'you',
  道: 'dao',
  遠: 'yuan',
  那: 'na',
  都: 'dou',
  里: 'li',
  重: 'zhong',
  野: 'ye',
  金: 'jin',
  针: 'zhen',
  钟: 'zhong',
  開: 'kai',
  间: 'jian',
  阳: 'yang',
  阴: 'yin',
  雨: 'yu',
  雪: 'xue',
  零: 'ling',
  青: 'qing',
  静: 'jing',
  非: 'fei',
  面: 'mian',
  音: 'yin',
  顺: 'shun',
  风: 'feng',
  飘: 'piao',
  飞: 'fei',
  首: 'shou',
  香: 'xiang',
  马: 'ma',
  高: 'gao',
  鬼: 'gui',
  魂: 'hun',
  魚: 'yu',
  鸟: 'niao',
  黄: 'huang',
  黑: 'hei',
  默: 'mo',
};

const CHOSEONG = [
  'g',
  'kk',
  'n',
  'd',
  'tt',
  'r',
  'm',
  'b',
  'pp',
  's',
  'ss',
  '',
  'j',
  'jj',
  'ch',
  'k',
  't',
  'p',
  'h',
];
const JUNGSEONG = [
  'a',
  'ae',
  'ya',
  'yae',
  'eo',
  'e',
  'yeo',
  'ye',
  'o',
  'wa',
  'wae',
  'oe',
  'yo',
  'u',
  'wo',
  'we',
  'wi',
  'yu',
  'eu',
  'ui',
  'i',
];
const JONGSEONG = [
  '',
  'k',
  'k',
  'ks',
  'n',
  'nj',
  'nh',
  't',
  'l',
  'lg',
  'lm',
  'lb',
  'ls',
  'lt',
  'lp',
  'lh',
  'm',
  'p',
  'ps',
  't',
  't',
  'ng',
  't',
  't',
  'k',
  't',
  'p',
  't',
];

export function hasHangul(text: string): boolean {
  return /[\uac00-\ud7a3]/.test(text);
}

export function hasKana(text: string): boolean {
  return /[\u3040-\u30ff]/.test(text);
}

export function hasHan(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

export function needsRomanization(text: string): boolean {
  return hasHangul(text) || hasKana(text) || hasHan(text);
}

function kataToHira(ch: string): string {
  const index = KATA.indexOf(ch);
  return index >= 0 ? HIRA[index]! : ch;
}

/** Hepburn for kana only — never apply Chinese pinyin on this path. */
function hepburnKanaOnly(text: string): { roma: string; leftoverHan: boolean } {
  let normalized = '';
  for (const ch of text) {
    normalized += kataToHira(ch);
  }
  let out = '';
  let leftoverHan = false;
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i]!;
    if (ch === 'っ' || ch === 'ッ') {
      const next = normalized.slice(i + 1, i + 3);
      const tri = KANA_ROMA[next] ?? KANA_ROMA[normalized[i + 1] ?? ''];
      const cons = tri?.match(/^[^aeiou]+/i)?.[0] ?? 't';
      out += cons.charAt(0);
      continue;
    }
    if (ch === 'ー') {
      const last = out.match(/[aeiou]$/i)?.[0];
      if (last) out += last;
      continue;
    }
    const trio = normalized.slice(i, i + 2);
    if (KANA_ROMA[trio]) {
      out += KANA_ROMA[trio];
      i += 1;
      continue;
    }
    if (KANA_ROMA[ch]) {
      out += KANA_ROMA[ch];
      continue;
    }
    if (/[\u3400-\u9fff]/.test(ch)) {
      leftoverHan = true;
      continue;
    }
    out += ch;
  }
  return { roma: out.replace(/\s+/g, ' ').trim(), leftoverHan };
}

function hangulRR(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code < 0xac00 || code > 0xd7a3) {
      out += ch;
      continue;
    }
    const s = code - 0xac00;
    const cho = Math.floor(s / 588);
    const jung = Math.floor((s % 588) / 28);
    const jong = s % 28;
    out += `${CHOSEONG[cho]}${JUNGSEONG[jung]}${JONGSEONG[jong]}`;
  }
  return out;
}

function hanPinyin(text: string): string {
  const parts: string[] = [];
  for (const ch of text) {
    if (PINYIN[ch]) parts.push(PINYIN[ch]!);
    else if (/\s/.test(ch)) parts.push(' ');
    else if (KANA_ROMA[kataToHira(ch)] || KANA_ROMA[ch]) {
      parts.push(hepburnKanaOnly(ch).roma);
    } else parts.push(ch);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Offline / Unison-miss fallback. Mixed JP kanji+kana without a dictionary
 * returns '' (hide the row) instead of kana+pinyin garbage.
 */
export function romanizeLineLocal(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || !needsRomanization(trimmed)) return '';
  let result: string;
  if (hasHangul(trimmed) && !hasKana(trimmed)) {
    result = hangulRR(trimmed);
  } else if (hasKana(trimmed)) {
    const { roma, leftoverHan } = hepburnKanaOnly(trimmed);
    if (leftoverHan) return '';
    result = roma;
  } else if (hasHan(trimmed)) {
    result = hanPinyin(trimmed);
  } else {
    result = '';
  }
  const collapsed = result.replace(/\s+/g, ' ').trim();
  if (!collapsed || collapsed === trimmed) return '';
  if (hasHan(collapsed) || hasKana(collapsed) || hasHangul(collapsed)) return '';
  return collapsed;
}

/** Sync helper for tests / pure-kana paths. Prefer romanizeLines when online. */
export function romanizeLine(text: string): string {
  return romanizeLineLocal(text);
}

function isCleanRomaji(s: string): boolean {
  return Boolean(s) && !hasHan(s) && !hasKana(s) && !hasHangul(s);
}

/** JP lyric that benefits from a morphological dictionary (any kana line). */
function wantsKuroshiro(text: string): boolean {
  return hasKana(text);
}

export type RomajiSource = 'unison' | 'kuroshiro' | 'local' | 'none';

export interface RomanizeLinesOptions {
  fetchFn?: UnisonFetch;
  unisonUrl?: string;
  signal?: AbortSignal;
  /** Injected Unison results (tests). */
  unisonRomanizations?: string[] | null;
  /** Offline JP converter; defaults to kuroshiro when omitted. */
  kuroshiroFn?: (text: string) => Promise<string>;
  log?: (message: string) => void;
}

export async function romanizeLines<T extends { text: string }>(
  lines: readonly T[],
  opts: RomanizeLinesOptions = {},
): Promise<T[]> {
  const texts = lines.map((line) => line.text);
  const need = texts.some((t) => needsUnisonRomanize(t));
  let unison: string[] | null = null;
  if (opts.unisonRomanizations !== undefined) {
    unison = opts.unisonRomanizations;
  } else if (need && opts.fetchFn) {
    unison = await fetchUnisonRomanizations(texts, {
      fetchFn: opts.fetchFn,
      baseUrl: opts.unisonUrl,
      signal: opts.signal,
    });
  }

  let kuroshiroFn = opts.kuroshiroFn;
  if (!kuroshiroFn && texts.some((t) => wantsKuroshiro(t) || hasKana(t))) {
    const { romanizeWithKuroshiro } = await import('./kuroshiro-romanize.js');
    kuroshiroFn = romanizeWithKuroshiro;
  }

  const sources: RomajiSource[] = [];
  const out: T[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const fromUnison = unison?.[i]?.trim() ?? '';
    if (isCleanRomaji(fromUnison)) {
      sources.push('unison');
      out.push({ ...line, romaji: fromUnison });
      continue;
    }

    const text = line.text;
    if (wantsKuroshiro(text)) {
      const fromKuro = kuroshiroFn ? (await kuroshiroFn(text)).trim() : '';
      if (isCleanRomaji(fromKuro)) {
        sources.push('kuroshiro');
        out.push({ ...line, romaji: fromKuro });
        continue;
      }
    }

    const local = romanizeLineLocal(text);
    if (local) {
      sources.push('local');
      out.push({ ...line, romaji: local });
    } else {
      sources.push('none');
      out.push({ ...line });
    }
  }

  if (opts.log && sources.length > 0) {
    const primary =
      sources.includes('unison')
        ? 'unison'
        : sources.includes('kuroshiro')
          ? 'kuroshiro'
          : sources.includes('local')
            ? 'local'
            : 'none';
    opts.log(`romaji via ${primary}`);
  }
  return out;
}
