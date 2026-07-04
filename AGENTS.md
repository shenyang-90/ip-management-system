# AGENTS.md — IP Management System

> 快速参考文档，供 AI 代理理解项目架构和关键文件路径。

## 项目概述

**IP Management System** 是一个纯前端的硬件 IP 核集成设计工具（对标 Vivado IP Integrator），通过 HTML5 Canvas 渲染 Block Design 画布，所有数据存储在本地 JSON 文件中。

- **部署模式**：模式1（本地文件网页）——直接打开 `index.html`，无需后端
- **技术栈**：原生 JavaScript ES6 Modules + HTML5 Canvas 2D + 原生 CSS
- **数据格式**：JSON 文件通过 `fetch()` 加载，通过 `Blob` 下载保存

## 目录结构速查

```
IP Management System/
├── index.html                          # 主入口，三栏布局 + 工具栏 + 状态栏 + 模态框
├── css/style.css                       # 暗色 Vivado 风格样式
├── src/main.js                         # App 类：初始化所有服务/组件，事件总线，快捷键
├── src/models/
│   ├── IPEntity.js                     # IP 核定义：VLNV (vendor:library:name:version)、接口、参数、寄存器映射
│   ├── BlockDesign.js                  # BDCell + BDConnection + AddressRegion
│   └── (InterfaceDefinition.js 已删除，接口模板直接使用 data/interface_templates.json)
├── src/services/
│   ├── IPCatalogService.js             # IP 目录 CRUD：getAll/getById/getByVLNV/search/create/update/delete
│   ├── BlockDesignService.js           # 画布管理：addIPInstance/removeCell/moveCell + 地址区域管理 + validateAddressRegions()
│   └── FileStorage.js                  # loadIPCatalog/loadDesign/saveDesign/exportDesignAsTcl
├── src/components/
│   ├── CanvasRenderer.js               # Canvas 2D 渲染：grid/cells/connections/ports/tempConnection/validation高亮
│   ├── IPCatalogPanel.js               # 左侧面板：IP 列表 + 搜索 + 分类过滤 + 详情弹窗 + importIP()
│   ├── PropertiesPanel.js              # 右侧面板：属性展示 + 参数编辑 + 地址区域编辑 + 信号连接展示
│   ├── PackageIPWizard.js            # 6 步 IP 封装向导：收集 packageData → 创建 IPEntity → 保存到 Catalog
│   ├── ValidationReportPanel.js        # DRC 验证报告面板：错误列表 + 画布定位高亮
│   └── SignalConnectionDialog.js       # 信号级连接对话框
├── src/utils/
│   ├── uuid.js                         # UUID v4 生成器
│   ├── wizard-helpers.js               # PackageIPWizard 纯函数辅助：Verilog 基础检查、enum 解析
│   └── parser-helpers.js               # XCI/IP-XACT 解析归一化辅助
├── tests/
│   ├── wizard-helpers.test.mjs         # Node.js 单元测试（wizard-helpers）
│   ├── parsers.test.mjs                # Node.js 单元测试（XCI/IP-XACT 解析器）
│   ├── package-ip-wizard-e2e.html      # 浏览器端 PackageIPWizard 端到端测试
│   ├── validation-report-panel-e2e.html  # 浏览器端验证报告面板 E2E
│   ├── address-region-editor-e2e.html    # 浏览器端地址分配编辑器 E2E
│   ├── signal-connection-e2e.html        # 浏览器端信号级连接 E2E
│   └── run-e2e.sh                        # headless Chrome 一键运行所有 E2E 测试
├── data/
│   ├── ip_catalog.json                 # 3 个示例 IP（Zynq PS、AXI GPIO、AXI Interconnect）
│   ├── interface_templates.json        # 5 个模板（AXI4/AXI-Lite/Stream/Clock/Reset）
│   └── designs/design_1.json           # 示例 Block Design（3 个 cell + 2 个连接 + 地址映射）
```

## 关键架构决策

### 1. 数据流（单向）
```
JSON 文件 → FileStorage.load → Service 层 → Component 渲染 → 用户交互 → Service 修改 → JSON 保存
```

### 2. 三层模型架构
- **IP Entity 层**：`ip_catalog.json` 中定义，包含寄存器偏移（相对地址）
- **Block Design 层**：`designs/*.json` 中定义，Cell 包含 `parameter_overrides` 和 `register_address_map`（绝对地址）
- **Address Region 层**：`address_regions[]` 包含完整的寄存器列表（含绝对地址）

### 3. Canvas 渲染机制
- `CanvasRenderer._portPositions` 每帧渲染时重建端口位置缓存（Map<cellId, Map<interfaceName, portInfo>>）
- 端口碰撞检测：`_buildPortPositions()` 先建缓存，`hitTestPort()` 查缓存
- 连接绘制：贝塞尔曲线，从端口中心到端口中心（非 Cell 边界中点）
- 临时连接线：`drawTempConnection()` 虚线贝塞尔，连接过程中显示

### 4. 连接状态机
```
idle → click port → isConnecting=true → mousemove (draw temp) → mouseup on target port → createConnection
```

## 修改文件时需要注意的约束

### 修改 `CanvasRenderer.js` 时
- 必须同时维护 `hitTestPort()` 和 `drawCellInterfaces()` 的逻辑一致性
- `_portPositions` 是每帧重建的，不要跨帧依赖其中的数据
- `render()` 中 `drawConnections()` 必须在 `drawCells()` 之前（连接在底层）
- 信号级连接（`connection_type === 'signal'`）从 Cell 中心绘制，使用虚线，无箭头

### 修改 `PackageIPWizard.js` 时
- `collectCurrentStepData()` 必须在 `prevStep()`/`nextStep()` 中调用，确保数据不丢失
- `finish()` 开头会调用 `collectAllStepData()` 作为最终兜底
- 每个 Step 的渲染函数必须能正确接收 `this.packageData` 作为数据源
- 版本冲突检测：`checkVersionConflict()` 依赖 `app.ipCatalogService.getByVLNV()`
- 纯逻辑辅助函数（Verilog 检查、enum 解析）建议放入 `src/utils/wizard-helpers.js` 以便测试

### 修改 `BlockDesignService.js` 时
- `removeCell()` 会自动级联删除关联的 `connections` 和 `address_regions`
- `validateAddressRegions()` 检查 `address_regions` 的 base/high 重叠
- `getCellInterfaces()` 从 IP Entity 定义获取接口，不是从 Cell 存储
- `addAddressRegion()` / `updateAddressRegion()` 会同步更新 Cell 的 `register_address_map`
- `connectSignals()` 已支持信号级连接数据模型

### 修改 `IPCatalogService.js` 时
- `create()` 使用 `new IPEntity(data)` 创建对象，会自动生成 UUID（`fromJSON()` 内部同样调用构造函数）
- `save()` 会调用 `FileStorage.saveIPCatalog()`，可能触发下载（非 Chrome 浏览器）
- `getByVLNV()` 是精确匹配四元组，区分大小写

### 修改数据模型时
- `IPEntity.toJSON()` 和 `fromJSON()` 必须保持对称
- `BDCell` 的 `parameter_overrides` 是对象而非数组
- `BDConnection` 的 `source_signal` / `target_signal` 仅用于信号级连接（`connection_type: 'signal'`）
- `AddressRegion` 的 `register_map` 是完整的寄存器对象数组（含 `absolute_address`）

## 数据格式速查

### IPEntity 的 VLNV
```javascript
// IPEntity.vlnv 是 getter，返回 `${vendor}:${library}:${name}:${version}`
// 不要直接修改 vlnv，修改 vendor/library/name/version 属性
```

### 参数类型
- `bool`: 值为 `true`/`false`
- `long`/`int`: 数值，可带 `range: { min, max }`
- `string`: 字符串值
- `enum`: 可带 `options: [{ value, label }]`

### 寄存器格式
```json
{
  "name": "GIER",
  "offset": "0x0000",
  "width": 32,
  "access": "RW",
  "reset_value": "0x00000000",
  "description": "...",
  "fields": [
    { "name": "GIE", "bit_range": [0, 0], "access": "RW", "description": "..." }
  ]
}
```

### 接口角色
- `master`: 发起方（绘制在 Cell 右侧）
- `slave`: 响应方（绘制在 Cell 左侧）
- `bidirectional`: 双向（绘制在 Cell 右侧）

## 常见操作路径

### 添加新功能到画布
1. 修改 `CanvasRenderer.js`：添加渲染逻辑 + 碰撞检测
2. 修改 `main.js`：在 `App` 类中添加事件处理
3. 修改 `index.html`：如有必要添加新 UI 元素
4. 修改 `css/style.css`：添加样式

### 添加新 IP 到 Catalog
- 方式1：通过 `PackageIPWizard` 封装（UI 流程）
- 方式2：直接编辑 `data/ip_catalog.json` 的 `ips` 数组
- 方式3：通过 `IPCatalogPanel.importIP()` 导入外部 JSON

### 修改 Tcl 导出格式
- 修改 `FileStorage.exportDesignAsTcl()`：注意 `ipCatalogService` 参数用于动态获取 VLNV
- 参数覆盖格式：`set_property -dict [list CONFIG.${paramName} {${value}}]`

## 测试验证

每次修改后应验证：
1. 语法检查：`find src tests -name '*.js' -o -name '*.mjs' | xargs node -c`
2. Node 单元测试：`node tests/wizard-helpers.test.mjs` 和 `node tests/parsers.test.mjs`
3. 浏览器 E2E 测试：`./tests/run-e2e.sh`（headless Chrome，自动启动 HTTP 服务器）
4. `index.html` 能在浏览器中正常加载（无 404）
5. 打开 DevTools Console 检查无红色错误
6. 核心操作：打开 → 添加 IP → 拖拽 → 连接 → 编辑参数 → 验证 → 导出 Tcl
