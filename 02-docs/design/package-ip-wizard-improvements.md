# PackageIPWizard 改进设计文档

## 目标

完善 IP 封装向导（PackageIPWizard）的细节体验，修复已知的交互缺陷，并扩展参数类型支持。

## 背景

`PackageIPWizard` 已实现 6 步封装流程，但在代码审查和一致性检查中发现以下问题：

1. **Step 2 文件删除按钮未绑定**：`renderFileList()` 生成了 `.btn-remove-item` 按钮，但 `renderStep2()` 未为其附加事件监听器，用户无法删除已添加的文件行。
2. **Step 4 缺少 `enum` 参数类型**：属性面板（`PropertiesPanel`）已支持 `enum` 类型，但封装向导无法创建 `enum` 参数。
3. **`finish()` 缺少兜底数据收集**：虽然 `nextStep()`/`prevStep()` 已调用 `collectCurrentStepData()`，但 `finish()` 未做最终兜底，若未来支持从中间步骤直接 Finish 会丢失数据。

## 改进方案

### 1. Step 2 文件删除按钮

**位置**：`src/components/PackageIPWizard.js` → `renderStep2()`

在 `renderStep2()` 渲染完成后，为 `#file-list-container` 内的所有 `.btn-remove-item` 按钮绑定点击事件：

```javascript
container.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.addEventListener('click', () => this.removeFile(parseInt(btn.dataset.idx, 10)));
});
```

与 Step 3/4/5 的删除按钮绑定模式保持一致。

### 2. Step 4 `enum` 参数类型

#### 2.1 渲染

在 `renderParameterList()` 的 `<select class="param-type">` 中增加：

```html
<option value="enum" ${p.type === 'enum' ? 'selected' : ''}>enum</option>
```

当参数类型为 `enum` 时，在参数行末尾显示 **Options** 输入框，格式为逗号分隔的 `value:label` 对：

```javascript
// 示例输入
0:Disabled, 1:Enabled
```

转换为内部结构：

```json
{
  "options": [
    { "value": 0, "label": "Disabled" },
    { "value": 1, "label": "Enabled" }
  ]
}
```

#### 2.2 收集数据

在 `collectCurrentStepData()` 和 `collectAllStepData()` 中增加 `enum` 分支：

```javascript
if (p.type === 'enum') {
    const optionsStr = row.querySelector('.param-options')?.value || '';
    p.options = this._parseEnumOptions(optionsStr);
    // 尝试将默认值解析为与首个 option value 同类型
    p.default = this._coerceEnumDefault(p.default, p.options);
}
```

辅助函数：

- `_parseEnumOptions(str)`：解析 `value:label` 列表，支持数值和字符串 value
- `_coerceEnumDefault(value, options)`：将输入默认值强制转换为与 option value 匹配的类型

### 3. `finish()` 兜底收集

在 `finish()` 开头调用 `this.collectAllStepData()`，确保当前可见步骤的 DOM 数据被收集。该函数仅在对应 DOM 元素存在时才覆盖 `packageData`，因此不会破坏已通过 `nextStep()` 收集的数据。

## 数据格式

### enum 参数示例

```json
{
  "name": "C_OPERATION",
  "display_name": "Operation Mode",
  "type": "enum",
  "default": 0,
  "options": [
    { "value": 0, "label": "Add" },
    { "value": 1, "label": "Subtract" }
  ]
}
```

## 测试策略

1. **单元测试**：抽取 `checkVerilogSyntax()` 和 enum 解析逻辑到可测试的纯函数，使用 Node.js 原生 `assert` 编写测试。
2. **端到端验证**：在浏览器中完成以下流程：
   - 打开 Package IP 向导
   - Step 2 添加文件后删除文件
   - Step 4 添加 enum 参数并设置 options
   - 完成封装并在 IP Catalog 中查看
   - 实例化新 IP，打开参数编辑模态框确认 enum 下拉框正常
   - Save IP Catalog 后重新加载页面，确认数据持久化

## 兼容性

- 保持纯前端零依赖
- 不修改现有 `bool`/`long`/`int`/`string` 参数行为
- 向后兼容：已有的非 enum 参数 JSON 不受影响
