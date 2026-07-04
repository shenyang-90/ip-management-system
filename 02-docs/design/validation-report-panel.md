# 验证报告面板设计文档

## 目标

将 DRC 验证结果从底部状态栏的单行文本升级为独立的验证报告面板，列出所有错误/警告，并在画布中高亮问题位置。

## 当前问题

- `validateDesign()` 仅通过 `app.updateStatus()` 输出一行总结
- 用户无法查看详细的验证消息列表
- 画布上没有视觉反馈指示哪些连接或 Cell 存在问题

## 改进方案

### 1. 新增 ValidationReportPanel 组件

文件：`src/components/ValidationReportPanel.js`

职责：
- 渲染验证报告面板（模态框或侧边滑出面板）
- 显示错误/警告列表，按类型分组
- 点击某条报告项时，在画布中定位并高亮对应元素
- 提供“重新验证”和“关闭”按钮

### 2. 报告数据结构

```javascript
{
  valid: boolean,
  summary: { errors: number, warnings: number },
  items: [
    {
      id: 'conn-001',
      type: 'connection',
      level: 'error', // error | warning
      message: 'Incompatible interfaces: axi4 master cannot connect to clock slave',
      target: { cellId?: string, connectionId?: string, interfaceName?: string }
    }
  ]
}
```

### 3. 集成到 App

- `main.js` 初始化 `ValidationReportPanel`
- 工具栏 **Validate** 按钮点击时：
  1. 运行 `connectionService.validateAll()` 和 `blockDesignService.validateAddressRegions()`
  2. 收集结果生成报告
  3. 打开报告面板
  4. 在画布中高亮所有问题连接/Cell

### 4. 画布高亮

- `CanvasRenderer` 增加 `_highlightedItems` 集合
- 渲染时：
  - 无效连接：红色线条 + 闪烁/加粗
  - 警告连接：黄色/橙色线条
  - 问题 Cell：红色边框
- 提供 `highlightValidationIssues(items)` 和 `clearValidationHighlights()` API

### 5. UI 设计

使用模态框（与 IP 详情弹窗一致），包含：
- 顶部：摘要（X errors, Y warnings）
- 中部：可滚动列表
  - 每行显示图标、级别、消息、定位按钮
- 底部：Re-validate、Close

## 测试策略

- 单元测试：
  - 报告生成逻辑
  - 高亮项分类（error/warning）
- 浏览器 E2E：
  - 创建无效连接（如 clock → reset）
  - 点击 Validate 打开面板
  - 确认报告项显示正确
  - 点击定位按钮，画布高亮对应元素
