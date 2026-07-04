# XCI / IP-XACT 导入健壮性改进设计文档

## 目标

修复 `XCIParser.js` 和 `IPXACTParser.js` 的输出，使其与项目内部数据模型（`IPEntity`、`PropertiesPanel`）保持一致，从而正确导入外部 IP 定义。

## 当前问题

### 1. 参数类型归一化不一致

内部 schema 支持的参数类型为：`bool`、`long`、`int`、`string`、`enum`。

当前解析器输出：

| 输入类型 | XCIParser 输出 | IPXACTParser 输出 | 内部期望 |
|---------|---------------|------------------|---------|
| `bool` / `boolean` | `boolean` | `boolean` | `bool` |
| `int` / `integer` / `long` | `integer` | `integer` | `long` 或 `int` |
| `float` / `double` / `real` | `float` | `float` | `long`（无浮点编辑） |
| `bit_vector` / `std_logic_vector` | `bit_vector` | `bit_vector` | `string` |
| 字符串 | `string` | `string` | `string` |

结果：导入的 IP 参数无法被 `PropertiesPanel` 识别为特定类型，编辑模态框回退为普通文本输入。

### 2. `file_groups` 结构不一致

内部 schema：

```json
{ "type": "synthesis", "files": ["rtl/foo.v"] }
```

解析器输出：

```json
{ "name": "fs", "files": [{ "path": "rtl/foo.v", "type": "verilogSource" }] }
```

`IPCatalogPanel.importIP()` 和 `IPEntity` 不处理后一种结构。

### 3. IP-XACT 默认命名空间处理失败

`_detectNamespace()` 在默认命名空间（`xmlns="...ipxact..."`）时返回空字符串，随后 `_ns('busInterface')` 返回 `'busInterface'`。`querySelector('busInterface')` **无法匹配**具有默认命名空间的元素，导致 bus interfaces、parameters、file sets、memory maps 全部解析为空。

### 4. 寄存器 `offset` 类型不一致

`_parseMemoryMaps()` 将 `offset` 计算为数值（`baseAddress + offset`），而内部寄存器格式期望字符串偏移（如 `"0x0000"`）。

## 改进方案

### 参数类型归一化

统一实现 `_normalizeParamType(type)`：

```
bool/boolean       → bool
int/integer/long   → long
float/double/real  → long（或保留为 string，视项目需求）
bit/bitvector/...  → string
其他               → string
```

> 项目当前无 `float` 参数编辑支持，为避免类型丢失，浮点值以 `string` 类型导入，值保持原样。

### `file_groups` 结构归一化

新增辅助函数 `_normalizeFileGroups(fileGroups)`，将解析器输出转换为内部 schema：

```javascript
function _normalizeFileGroups(fileGroups) {
    const groups = {};
    for (const fg of fileGroups) {
        const type = _normalizeFileGroupType(fg.name);
        if (!groups[type]) groups[type] = [];
        for (const f of fg.files) {
            const path = typeof f === 'string' ? f : (f.path || f.name || '');
            if (path) groups[type].push(path);
        }
    }
    return Object.entries(groups).map(([type, files]) => ({ type, files }));
}
```

文件组类型映射：

| 原始 name / fileType | 归一化类型 |
|---------------------|-----------|
| `hdlSource`, `synthesis`, `verilogSource`, `vhdlSource` | `synthesis` |
| `simulation`, `simSource`, `testbench` | `simulation` |
| `constraint`, `xdc`, `sdc` | `constraint` |
| `documentation`, `doc` | `documentation` |
| 其他 | 原始 name 小写 |

### IP-XACT 默认命名空间修复

采用两种策略确保命名空间不丢失：

1. **有前缀命名空间**：继续使用 `prefix:tagName`。
2. **默认命名空间**：使用 `*[local-name()='tagName']` 选择器。

修改 `_ns(tagName)`：

```javascript
_ns(tagName) {
    if (this.namespacePrefix) {
        return this.namespacePrefix + tagName;
    }
    // Default namespace: match by local name
    return `*[local-name()='${tagName}']`;
}
```

同时 `_getText` 和 `_getChild` 也需要支持默认命名空间。

### 寄存器 offset 格式

在 IP-XACT 解析中，保留 `addressOffset` 为字符串形式：

```javascript
offset: this._formatAddress(offsetValue)
```

`_formatAddress(value)` 将数值转换为 `"0x0000"` 格式字符串。

## 测试策略

- 单元测试覆盖：
  - `_normalizeParamType` 各种输入输出
  - `_normalizeFileGroups` 结构转换
  - `_ns` 默认/前缀命名空间选择器
  - `_formatAddress` 地址格式化
  - 完整 XCI / IP-XACT XML 解析端到端（使用模拟 XML 字符串）
- 浏览器手动验证：导入 `.xci` 和 `.xml` 示例文件，检查参数编辑器和文件组显示。
