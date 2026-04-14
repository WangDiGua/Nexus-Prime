# 外部 MCP 图表输出规范

本文定义外部 MCP 在需要返回图表、统计图、关系图、地图等可视化结果时应遵守的统一协议。

目标不是让 MCP 负责“怎么渲染”，而是让 MCP 负责“描述什么图表、用什么数据、用什么图表语义”。平台前端负责统一渲染。

## 设计原则

1. 外部 MCP **必须返回结构化 JSON**。
2. 默认使用 **ECharts Option** 作为主渲染载体。
3. 外部 MCP **不得直接返回可执行 JavaScript** 作为主方案。
4. 外部 MCP **不得依赖前端内嵌 HTML** 来完成主渲染。
5. 必须同时返回 **原始数据**，用于降级、导出和复核。
6. 前端渲染失败时，必须能回退到表格或文本摘要。

## 协议总览

外部 MCP 在输出图表时，应返回如下顶层结构：

```json
{
  "type": "visualization",
  "version": "1.0",
  "renderer": "echarts",
  "title": "示例标题",
  "subtitle": "示例副标题",
  "description": "图表说明",
  "chart": {
    "kind": "bar",
    "spec": {
      "option": {}
    }
  },
  "data": {
    "source": []
  },
  "style": {
    "theme": "light",
    "width": "100%",
    "height": 420,
    "responsive": true
  },
  "interaction": {
    "tooltip": true,
    "legend": true,
    "dataZoom": false,
    "saveAsImage": true,
    "clickable": false
  },
  "fallback": {
    "type": "table",
    "showRawData": true
  },
  "meta": {
    "source": "external-mcp",
    "generatedAt": "2026-04-14T10:00:00+08:00"
  }
}
```

## 字段定义

### `type`

固定值：`visualization`

表示当前消息是一个可视化结果，而不是普通文本或普通工具返回。

### `version`

固定值：`1.0`

用于未来做协议升级和兼容处理。

### `renderer`

指定渲染器类型。

推荐支持：

- `echarts`
- `vega`
- `svg`
- `table`
- `markdown`

平台应优先支持 `echarts`，因为它覆盖面最广。

### `title` / `subtitle` / `description`

- `title`：图表主标题
- `subtitle`：副标题，可选
- `description`：面向用户的简短说明，可选

### `chart.kind`

图表语义类型，用于前端识别和兜底。

推荐值：

- `bar`
- `line`
- `pie`
- `scatter`
- `radar`
- `heatmap`
- `tree`
- `graph`
- `map`
- `candlestick`
- `sankey`
- `gauge`
- `funnel`
- `boxplot`
- `liquid`
- `wordcloud`
- `custom`

如果是 ECharts 原生图表，`kind` 应尽量与实际类型一致。

### `chart.spec.option`

这是核心字段。

当 `renderer = "echarts"` 时，外部 MCP 应直接返回 ECharts 原生 `option` 对象。

平台侧应将该对象作为最终渲染输入，不要求 MCP 再转换为 HTML、SVG 或图片。

### `data.source`

必须返回原始数据。

要求：

- 保留可复核的明细数据
- 不要只返回渲染后配置
- 如果图表是聚合结果，也要尽量返回聚合前或聚合后的结构化数据

### `style`

可选样式控制：

- `theme`：`light` 或 `dark`
- `width`：默认 `100%`
- `height`：建议数值，单位由平台解释
- `responsive`：是否响应式适配

### `interaction`

图表交互开关：

- `tooltip`：是否允许悬浮提示
- `legend`：是否显示图例
- `dataZoom`：是否允许缩放
- `saveAsImage`：是否允许导出图片
- `clickable`：是否支持点击事件

### `fallback`

用于前端无法渲染或图表类型不支持时的降级。

推荐值：

- `type: "table"`
- `type: "markdown"`
- `type: "text"`

建议至少提供：

- `type`
- `showRawData`

### `meta`

可选元信息：

- `source`：来源标识
- `generatedAt`：生成时间
- `requestId`：请求追踪 ID
- `locale`：语言区域

## 约束规则

### 必须

1. 必须返回合法 JSON。
2. 必须包含 `type`、`version`、`renderer`、`title`、`chart.kind`、`data.source`、`fallback`。
3. `renderer = "echarts"` 时必须包含 `chart.spec.option`。
4. `data.source` 必须可被前端直接读取。
5. 不允许将 HTML 作为主渲染载体。
6. 不允许将可执行 JavaScript 作为主渲染载体。

### 建议

1. `chart.kind` 与 `renderer` 保持一致。
2. `data.source` 与 `option` 的关键数据保持可互相验证。
3. 图表标题应短且明确。
4. 如果数据较多，提供聚合后的图表数据和原始数据摘要。

## 示例

### 示例 1：柱状图

```json
{
  "type": "visualization",
  "version": "1.0",
  "renderer": "echarts",
  "title": "35岁以上教职工籍贯分布",
  "subtitle": "按省份统计",
  "description": "展示35岁以上教职工的籍贯来源分布情况。",
  "chart": {
    "kind": "bar",
    "spec": {
      "option": {
        "tooltip": { "trigger": "axis" },
        "grid": { "left": 48, "right": 24, "top": 48, "bottom": 48, "containLabel": true },
        "xAxis": {
          "type": "category",
          "data": ["江苏", "浙江", "山东", "河南", "四川"],
          "axisLabel": { "interval": 0 }
        },
        "yAxis": { "type": "value", "name": "人数" },
        "series": [
          {
            "name": "人数",
            "type": "bar",
            "data": [128, 95, 82, 67, 54],
            "barWidth": 36,
            "itemStyle": { "color": "#2563eb" },
            "label": { "show": true, "position": "top" }
          }
        ]
      }
    }
  },
  "data": {
    "source": [
      { "name": "江苏", "value": 128 },
      { "name": "浙江", "value": 95 },
      { "name": "山东", "value": 82 },
      { "name": "河南", "value": 67 },
      { "name": "四川", "value": 54 }
    ]
  },
  "style": {
    "theme": "light",
    "width": "100%",
    "height": 420,
    "responsive": true
  },
  "interaction": {
    "tooltip": true,
    "legend": false,
    "dataZoom": false,
    "saveAsImage": true,
    "clickable": false
  },
  "fallback": {
    "type": "table",
    "showRawData": true
  }
}
```

### 示例 2：折线图

```json
{
  "type": "visualization",
  "version": "1.0",
  "renderer": "echarts",
  "title": "近 7 天访问趋势",
  "chart": {
    "kind": "line",
    "spec": {
      "option": {
        "tooltip": { "trigger": "axis" },
        "xAxis": {
          "type": "category",
          "data": ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        },
        "yAxis": { "type": "value" },
        "series": [
          {
            "name": "访问量",
            "type": "line",
            "smooth": true,
            "data": [12, 18, 16, 22, 20, 26, 30]
          }
        ]
      }
    }
  },
  "data": {
    "source": [
      { "day": "周一", "value": 12 },
      { "day": "周二", "value": 18 },
      { "day": "周三", "value": 16 },
      { "day": "周四", "value": 22 },
      { "day": "周五", "value": 20 },
      { "day": "周六", "value": 26 },
      { "day": "周日", "value": 30 }
    ]
  },
  "fallback": {
    "type": "table",
    "showRawData": true
  }
}
```

## 错误返回

当 MCP 无法生成图表时，应返回结构化错误，而不是空字符串或非 JSON 内容。

```json
{
  "type": "visualization_error",
  "version": "1.0",
  "code": "INSUFFICIENT_DATA",
  "message": "无法根据当前数据生成图表",
  "fallback": {
    "type": "text",
    "showRawData": true
  }
}
```

## 平台侧处理建议

平台收到该协议后，建议按以下顺序处理：

1. 校验 JSON 结构是否合法。
2. 判断 `renderer` 是否受支持。
3. 优先读取 `chart.spec.option` 并交给对应渲染器。
4. 如果渲染失败，使用 `fallback`。
5. 如果 `fallback` 也不可用，则降级为原始文本展示。

## 外部 MCP 接入要求

外部 MCP 实现方应遵守：

- 只输出 JSON
- 字段名保持稳定
- 不随意新增会影响解析的顶层字段
- 若要扩展字段，应放入 `meta` 或 `extensions`
- 不要把渲染逻辑写死在工具输出里

## 扩展建议

如需支持更复杂的图表能力，可在后续版本增加：

- `transform`
- `dataset`
- `annotations`
- `events`
- `drilldown`
- `export`
- `accessibility`

这些字段都应作为向后兼容扩展，而不是破坏当前协议。

