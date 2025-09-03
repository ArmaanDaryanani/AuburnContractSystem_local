declare module 'mammoth' {
  export interface ConversionResult {
    value: string;
    messages: ConversionMessage[];
  }

  export interface ConversionMessage {
    type: string;
    message: string;
  }

  export interface ConversionOptions {
    styleMap?: string[];
    includeEmbeddedStyleMap?: boolean;
    includeDefaultStyleMap?: boolean;
    convertImage?: (element: any, messages: ConversionMessage[]) => Promise<any>;
    ignoreEmptyParagraphs?: boolean;
    idPrefix?: string;
    transformDocument?: (element: any) => any;
  }

  export function extractRawText(input: { path?: string; buffer?: Buffer; arrayBuffer?: ArrayBuffer }, options?: ConversionOptions): Promise<ConversionResult>;
  
  export function convertToHtml(input: { path?: string; buffer?: Buffer; arrayBuffer?: ArrayBuffer }, options?: ConversionOptions): Promise<ConversionResult>;
  
  export function convertToMarkdown(input: { path?: string; buffer?: Buffer; arrayBuffer?: ArrayBuffer }, options?: ConversionOptions): Promise<ConversionResult>;

  export function embedStyleMap(input: { path?: string; buffer?: Buffer; arrayBuffer?: ArrayBuffer }, styleMap: string): Promise<Buffer>;
}