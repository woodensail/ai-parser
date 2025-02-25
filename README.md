## README

### 项目简介

本项目是一个用于解析流式数据的解析器，支持多种预设配置以适应不同的API响应格式。它能够处理来自流式API的数据，并根据配置进行解析、验证和输出。

### 主要功能

- **自定义Chunk解析**：通过`chunkParser`函数可以自定义每个chunk的解析逻辑。
- **自动合并内容**：可以选择是否自动合并所有chunk的内容。
- **多种输出格式**：支持文本(`text`)和对象(`obj`)两种输出格式。
- **预设配置**：内置了针对不同API的预设配置，如OpenAI、DeepSeek、Dify等。

### 安装

```bash
npm install ai-parser
```


### 使用方法

#### 导入模块

```javascript
import Parser from 'ai-parser';
```


#### 创建解析器实例

可以通过构造函数或使用预设配置创建解析器实例。

##### 使用默认配置

```javascript
const parser = new Parser({
  chunkType: 'json',
  contentPath: 'content',
  autoConcat: true,
  outputType: 'text'
});
```


##### 使用预设配置

```javascript
const parser = Parser.PRESETS.DifyApp();
```


#### 解析流式数据

```javascript
fetch('http://example.com/api', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    authorization: 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    inputs: { title: "123" },
    response_mode: "streaming"
  })
}).then(async response => {
  const reader = response.body.getReader();
  for await (const data of await parser.parse(reader)) {
    console.log(data);
  }
});
```


### 配置选项

| 属性名       | 类型                  | 描述                                                                                       | 默认值     |
|------------|---------------------|----------------------------------------------------------------------------------------|---------|
| chunkParser | `(chunk: any, context: any) => any` | 指定chunk解析器，返回值为本次yield输出的内容，如果返回Error对象。                                             | -       |
| chunkType   | `'json' \| 'text'`      | 指定chunk内容的格式，当存在chunkParser时，忽略该参数。                                                   | `'json'` |
| contentPath | `string`               | 指定chunk内容中返回内容对应的路径，仅在`chunkType`为`json`时有效。                                            | `'content'` |
| autoConcat  | `boolean`              | 是否自动合并所有内容，当存在chunkParser时，忽略该参数。                                                    | `true`   |
| outputType  | `'text' \| 'obj'`      | 指定输出类型，当存在chunkParser时，忽略该参数。                                                             | `'text'` |
| validateChunk | `(chunk: string) => undefined \| Error` | 验证chunk内容，如果返回undefined，则通过验证，否则返回错误，当存在chunkParser时，忽略该参数。                     | -       |

### 预设配置

| 预设名称 | 描述                                                          |
|--------|-------------------------------------------------------------|
| OpenAi | 适用于OpenAI API的解析配置，提取`choices[0].delta.content`路径的内容并合并后返回。 |
| DeepSeek | 适用于DeepSeek的解析配置，将分别提取思考和回答内容，合并输出到两个字段中。                   |
| Dify | 提取`answer`路径的内容并合并后返回。                                      |
| DifyApp | 根据事件类型更新上下文中的当前内容，并返回最终结果。                                  |

### 注意事项

- 确保API响应的格式与解析器配置相匹配，以避免解析失败。
- 在使用预设配置时，请根据实际需求调整配置项。
- 如果遇到解析失败的情况，请检查API响应格式是否正确，或者尝试自定义`chunkParser`进行更灵活的解析。
