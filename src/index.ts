import {get, mapValues} from 'radash'

export interface ParserOption {
  /**
   * 指定chunk解析器，返回值为本次 yield 输出的内容，如果返回Error对象。
   * @param chunk 本次chunk内容。
   * @param context 上下文对象，用于存储中间变量，初始状态为空对象。
   */
  chunkParser?: (chunk: any, context: any) => any;
  /**
   指定chunk内容的格式，当存在chunkParser时，忽略该参数。
   * - 如果为`json`，chunk内容将被自动解析为JSON对象。
   * - 如果为`text`，chunk内容将直接返回为字符串。
   * @type {'json' | 'text'}
   * @default 'json'
   */
  chunkType?: 'json' | 'text';

  /**
   * 指定chunk内容中返回内容对应的路径，使用 lodash.get 解析该路径,当存在chunkParser时，忽略该参数。
   * 该字段仅在`chunkType`为`json`时有效。
   * @type {string}
   * @default 'content'
   */
  contentPath?: string;

  /**
   * 是否自动合并所有内容，当存在chunkParser时，忽略该参数。
   * - 如果为`true`，所有内容将被合并后返回。
   * - 如果为`false`，每次`onUpdate`将返回一个单独的块，不会合并所有内容。
   * @type {boolean}
   * @default true
   */
  autoConcat?: boolean;

  /**
   * 指定输出类型，当存在chunkParser时，忽略该参数。
   * - `'text'`：输出为文本。
   * - `'obj'`：输出为对象。
   * @type {'text' | 'obj'}
   * @default 'text'
   */
  outputType?: 'text' | 'obj';
  /**
   * 验证chunk内容，如果返回undefined，则通过验证，否则返回错误，当存在chunkParser时，忽略该参数。
   */
  validateChunk?: (chunk: string) => undefined | Error;
}

// 默认配置
const defaultOptions: ParserOption = {
  chunkType: 'json', contentPath: 'content', autoConcat: true,
};

// 预设配置
const PRESETS = {
  OpenAi: {
    chunkType: 'json', contentPath: 'choices[0].delta.content', autoConcat: true, outputType: 'text',
  },
  DeepSeek: {
    chunkParser(chunk: string, context: any) {
      const obj = JSON.parse(chunk.trim());
      const chunkType = get(obj, 'choices[0].delta.content') as any
      if (chunkType) {
        if (!context[chunkType]) {
          context[chunkType] = ''
        }
        context[chunkType] += chunkType
      }
      return context
    }
  },
  Dify: {
    chunkType: 'json', contentPath: 'answer', autoConcat: true, outputType: 'text',
  },
  DifyApp: {
    chunkParser(chunk: string, context: any) {
      const obj = JSON.parse(chunk.trim()) || {};
      if (obj.event === 'node_started' && obj.data.node_type !== 'start') {
        context.current = obj.data.title || context.current;
      } else if (['iteration_started', 'iteration_next'].includes(obj.event)) {
        context.current = obj.data.title || context.current;
      } else if (obj.event === 'node_finished') {
        context.current = obj.data.outputs.output || context.current;
      }
      return context.current
    }
  },
}

export default class Parser {
  options: ParserOption;

  constructor(options: ParserOption) {
    this.options = {...defaultOptions, ...options};
  }

  static PRESETS = mapValues(PRESETS, (config) => {
    return (options: ParserOption) => new Parser({...options, ...config as any})
  });

  async* parse(reader: ReadableStreamDefaultReader) {
    const decoder = new TextDecoder();
    try {
      // 未读取完的流内容，当流数据中一行数据过长时，可能会被拆分，导致json不完整，必须和后续数据合并后再解析
      let unfinishedText = '';
      // 已经解析到的输出文本，用于合并回答内容并输出
      let output = '';
      const context = {}
      while (true) {
        const {done, value} = await reader.read();
        const text = unfinishedText + (value ? decoder.decode(value) : '');
        let rows = text.split('\n');
        // 如果没有读取到流结束，则将最后一行数据保存到unfinishedText中，等待下一次读取，以防止本行数据不完整
        if(!done){
          unfinishedText = rows.pop() || '';
        }
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row.startsWith('data:')) {
            // 忽略所有非数据内容
            continue;
          }
          const data = row.substring(5);

          // 如果有自定义解析器，则执行自定义解析流程
          if (this.options.chunkParser) {
            const result = this.options.chunkParser(data, context)
            yield result
            if (result instanceof Error) {
              console.error(result)
              return
            }
          } else {
            // 解析当前chunk中的文本内容
            let chunkContent = '';
            if (this.options.chunkType === 'text') {
              chunkContent = data;
            } else {
              try {
                const chunk = JSON.parse(data.trim());
                chunkContent = get(chunk, this.options.contentPath ?? '') ?? '';
              } catch (e) {
                // 解析失败，忽略该行数据
                console.error(e);
              }
            }
            // 本次回调的文本内容
            let outputText = '';
            if (this.options.autoConcat) {
              output = output + chunkContent;
              outputText = output;
            } else {
              outputText = chunkContent;
            }
            // 根据配置输出类型，返回不同格式的输出
            if (this.options.outputType === 'text') {
              yield outputText;
            } else {
              yield {
                text: outputText,
              };
            }
          }
        }
        if (done) {
          break;
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
}
