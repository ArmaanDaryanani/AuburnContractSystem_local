declare module 'mark.js' {
  export interface MarkOptions {
    element?: string;
    className?: string;
    exclude?: string[];
    separateWordSearch?: boolean;
    accuracy?: 'partially' | 'complementary' | 'exactly';
    diacritics?: boolean;
    synonyms?: { [key: string]: string };
    iframes?: boolean;
    iframesTimeout?: number;
    acrossElements?: boolean;
    caseSensitive?: boolean;
    ignoreJoiners?: boolean;
    ignorePunctuation?: string[];
    wildcards?: 'disabled' | 'enabled' | 'withSpaces';
    each?: (element: HTMLElement) => void;
    filter?: (textNode: Node, term: string, totalCounter: number, termCounter: number) => boolean;
    noMatch?: (term: string) => void;
    done?: (totalMatches: number) => void;
    debug?: boolean;
    log?: any;
  }

  export default class Mark {
    constructor(context: HTMLElement | HTMLElement[] | NodeList | string);
    mark(keyword: string | string[], options?: MarkOptions): void;
    markRegExp(regexp: RegExp, options?: MarkOptions): void;
    markRanges(ranges: Array<{ start: number; length: number }>, options?: MarkOptions): void;
    unmark(options?: { element?: string; className?: string; exclude?: string[]; done?: () => void }): void;
  }
}
