# IP Management System — 代码审查报告

**审查日期**: 2026-06-28  
**审查范围**: README.md, AGENTS.md, index.html, 全部 JS 源码, JSON 数据文件  
**审查目标**: 功能完整性核对、文档-代码一致性检查、Bug 识别

---

## 一、README 功能特性 vs 代码实现

| # | README 声称的功能 | 实现状态 | 备注 |
|---|------------------|---------|------|
| 1 | IP Catalog 管理 | ✅ 完整 | IPCatalogPanel + IPCatalogService |
| 2 | IP 封装向导 | ✅ 完整 | PackageIPWizard (6 步) |
| 3 | Block Design 画布 | ✅ 完整 | CanvasRenderer |
| 4 | 拖拽添加与连接 | ✅ 完整 | CanvasRenderer + 事件处理 |
| 5 | 自动连接 | ✅ 完整 | BlockDesignService.autoConnect() |
| 6 | 参数配置 | ✅ 完整 | PropertiesPanel + 模态框 |
| 7 | 地址映射与冲突检测 | ⚠️ 半实现 | 验证逻辑存在，**无编辑 UI** |
| 8 | Tcl 脚本导出 | ✅ 完整 | FileStorage.exportDesignAsTcl() |
| 9 | 导入 XCI/IP-XACT 文件 | ❌ **虚假宣传** | 实际只支持 JSON 导入 |
| 10 | 设计验证报告 | ❌ 未实现 | README 写"即将推出" |
| 11 | 综合与实现 | ❌ 未实现 | README 写"即将推出" |
| 12 | RTL 代码导出 | ❌ 未实现 | README 写"即将推出" |

### 关键发现

**README 第 9 项是误导性描述。** IPCatalogPanel.importIP() 的代码：
```javascript
const ipData = JSON.parse(text);  // 只解析 JSON
this.app.ipCatalogService.create(ipData);
```
没有 XCI 解析器，没有 IP-XACT XML 解析器。README 应该改成"导入 JSON 格式 IP 定义"。

---

## 二、Bug 与代码缺陷

### 🔴 Bug-1: Validate 按钮会崩溃

**位置**: `src/main.js` → `validateDesign()`

**问题代码**:
```javascript
this.connectionService = this.blockDesignService;  // 同一个对象
// ...
const connResults = this.connectionService.validateAll();  // ❌ 不存在！
```

**BlockDesignService.js 中没有 `validateAll()` 方法。** 点击 Validate 按钮会抛出 `TypeError: this.connectionService.validateAll is not a function`。

**修复建议**: 在 BlockDesignService 中添加 `validateAll()` 方法，或在 main.js 中直接遍历 connections 检查。

---

### 🔴 Bug-2: Save 永远显示成功

**位置**: `src/services/FileStorage.js` → `_saveToFile()`

**问题**: 无论 File System Access API 是否可用，`_saveToFile()` 总是 `resolve(true)`。这意味着：
- 保存失败（如 CORS 限制）也会返回 `true`
- `main.js` 中的 `if (success)` 检查形同虚设

---

### 🟡 Bug-3: InterfaceDefinition.js 是死代码

**位置**: `src/models/InterfaceDefinition.js`

**问题**: 这个类定义了完整的接口模型（含 UUID 生成、toJSON/fromJSON），但：
- `interface_templates.json` 使用扁平格式，不经过 `InterfaceDefinition.fromJSON()`
- `PackageIPWizard.loadInterfaceTemplates()` 直接存原始 JSON
- 整个项目中没有任何地方 `new InterfaceDefinition()` 或调用其静态方法

**建议**: 删除此文件，或将 interface_templates.json 的加载改为使用 `InterfaceDefinition` 类。

---

### 🟡 Bug-4: UUID 生成代码重复 5 次

**位置**:
- `src/models/BlockDesign.js` × 3（BDCell、BDConnection、AddressRegion）
- `src/models/IPEntity.js` × 1
- `src/models/InterfaceDefinition.js` × 1

**问题**: 同一段 UUID 生成逻辑复制粘贴 5 处。任何修改需要改 5 个地方。

**建议**: 提取到 `src/utils/uuid.js` 共享模块。

---

### 🟡 Bug-5: PackageIPWizard "Check Syntax" 按钮名不副实

**位置**: `src/components/PackageIPWizard.js` → `checkVerilogSyntax()`

**问题**: 按钮标签是"Check Syntax"，实际代码只做了最基本的正则检查：
```javascript
checkVerilogSyntax(content) {
    const errors = [];
    // 检查 module 声明
    if (!/module\s+\w+\s*\(/.test(content)) {
        errors.push({ line: 1, message: 'Missing module declaration' });
    }
    // 检查 endmodule
    if (!/endmodule/.test(content)) {
        errors.push({ line: content.split('\n').length, message: 'Missing endmodule' });
    }
    return errors;
}
```

这不是语法检查，只是"是否存在 module/endmodule 关键字"检查。会误导用户以为做了完整的 Verilog 语法分析。

**建议**: 按钮改成"Basic Check"，或集成 verilator/iverilog 进行真正的语法检查。

---

### 🟡 Bug-6: File System Access API 写路径从未执行

**位置**: `src/services/FileStorage.js` → `_saveToFile()`

**问题**: 代码检测到 `showDirectoryPicker` 存在时，只是 `console.warn` 然后 fallback 到下载。真正的 API 写入路径（`writeFileToDirectory`）虽然在类中存在，但从未被调用。

---

## 三、文档-代码不一致

### AGENTS.md vs 代码

| AGENTS.md 声称 | 代码实际 |
|---------------|---------|
| `FileStorage.exportDesignAsTcl()` 需要 `ipCatalogService` 参数 | ✅ 正确 |
| `collectAllStepData()` 只收集当前可见 DOM | ✅ 正确 |
| `getCellInterfaces()` 从 IP Entity 获取 | ✅ 正确 |
| `removeCell()` 级联删除 connections 和 address_regions | ✅ 正确 |
| `hitTestPort()` 和 `drawCellInterfaces()` 需保持一致 | ⚠️ 需人工确认，逻辑上正确 |
| `render()` 中 drawConnections 在 drawCells 之前 | ✅ 正确 |

### README 技术栈说明 vs 实际

| README 声称 | 实际 |
|------------|------|
| 技术栈：原生 JS ES6 Modules + HTML5 Canvas 2D + CSS | ✅ 正确 |
| 数据格式：JSON 通过 fetch() 加载，Blob 下载保存 | ✅ 正确 |
| 支持导入 XCI/IP-XACT | ❌ 错误，只支持 JSON |

---

## 四、缺失功能清单

### 高优先级缺失（影响可用性）

1. **地址区域编辑器**
   - 数据模型支持 `address_regions`，但只能通过 JSON 手动编辑
   - 没有 UI 来分配/修改 slave AXI-Lite 的基地址

2. **验证报告面板**
   - `validateDesign()` 只在状态栏显示一行文字
   - 没有错误列表、没有跳转到错误位置
   - README 写"即将推出"，但代码里连占位 UI 都没有

3. **连接类型验证**
   - `autoConnect()` 按 type + role 匹配，但不检查接口协议兼容性
   - 例如：AXI4 master 连接到 AXI4-Lite slave 应该报错，目前不会

### 中优先级缺失

4. **信号级连接 UI**
   - 数据模型支持 `connection_type: 'signal'`，但 Canvas 上只渲染接口级连接
   - 没有信号选择/绑定界面

5. **撤销/重做**
   - 没有命令模式，没有 undo/redo 栈

6. **复制粘贴 Cell**
   - 只能从头添加，不能复制已有实例

### 低优先级缺失（文档已说明"即将推出"）

7. RTL 代码导出
8. 综合与实现流程
9. XCI/IP-XACT 导入

---

## 五、代码质量建议

### 可维护性

- [ ] 提取 `src/utils/uuid.js`，替换 5 处重复实现
- [ ] `InterfaceDefinition.js` 要么用起来，要么删掉
- [ ] `PackageIPWizard.js` 544 行，可考虑拆分为每步一个渲染器

### 健壮性

- [ ] `validateDesign()` 修复 `validateAll()` 不存在的问题
- [ ] `_saveToFile()` 区分"真正保存成功"和"下载 fallback"
- [ ] `importIP()` 增加文件类型校验（现在任何 .json 都直接 parse）

### 用户体验

- [ ] "Check Syntax" 按钮改名，避免误导
- [ ] 验证失败时在画布上高亮错误 Cell/Connection
- [ ] 添加地址映射编辑模态框（类似参数编辑）

---

## 六、结论

**整体评价**: 项目骨架完整，核心功能（画布、连接、参数、Tcl 导出）已实现。但存在 **1 个会导致按钮崩溃的 Bug**、**1 个 README 虚假宣传**、以及 **地址映射编辑 UI 缺失** 的问题。

**建议下一步优先级**:
1. 🔴 修复 `validateDesign()` Bug
2. 🟡 添加地址区域编辑 UI
3. 🟡 修正 README 中"导入 XCI/IP-XACT"的描述
4. 🟢 添加验证报告面板
