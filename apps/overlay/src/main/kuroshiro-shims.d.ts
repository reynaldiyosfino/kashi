declare module 'kuroshiro' {
  export default class Kuroshiro {
    init(analyzer: unknown): Promise<void>;
    convert(
      text: string,
      opts: { to: string; mode?: string; romajiSystem?: string },
    ): Promise<string>;
  }
}

declare module 'kuroshiro-analyzer-kuromoji' {
  export default class KuromojiAnalyzer {
    constructor(opts?: { dictPath?: string });
  }
}
