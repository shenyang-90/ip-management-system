# 系统架构设计

> **部署模式：本地文件网页（模式1）** —— 纯前端应用，直接打开 `index.html` 即可使用，无需后端服务。
> 所有数据以本地 JSON 文件形式存储，通过 `fetch()` 加载，通过 File System Access API 或 Blob 下载保存。

## 1. 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         浏览器                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     index.html                                │  │
│  │  ┌──────────────┬──────────────┬──────────────────────────┐  │  │
│  │  │  IP Catalog   │  Block Design │  Properties              │  │  │
│  │  │  Panel        │  Canvas       │  Panel                   │  │  │
│  │  └──────────────┴──────────────┴──────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  Components: CanvasRenderer, IPCatalogPanel,            │  │  │
│  │  │  PropertiesPanel, PackageIPWizard, Modal dialogs        │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  Services: IPCatalogService, BlockDesignService,        │  │  │
│  │  │  ConnectionService, FileStorage                         │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  Models: IPEntity, BlockDesign, BDCell, BDConnection,   │  │  │
│  │  │  AddressRegion                                          │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  通过 fetch() 读取本地 JSON 文件  │  通过 File System Access API    │
│  （首次加载 / Open Design）        │  直接读写本地文件（Chrome）       │
│                              │  非 Chrome 回退为 Blob 下载        │
│  ┌──────────────────────┐  ┌─────────────────────────────────────┐ │
│  │  data/ip_catalog.json  │  │  data/designs/*.json                 │ │
│  │  data/interface_       │  │  （IP 定义、设计文件、接口模板）       │ │
│  │  templates.json        │  │                                      │ │
│  └──────────────────────┘  └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. 模块划分

| 模块 | 职责 | 核心类/文件 |
|------|------|------------|
| `models` | 数据模型与 JSON 序列化 | `IPEntity`, `BlockDesign`, `BDCell`, `BDConnection`, `AddressRegion` |
| `services` | 业务逻辑与状态管理 | `IPCatalogService`, `BlockDesignService`, `ConnectionService`, `FileStorage` |
| `components` | UI 渲染与用户交互 | `CanvasRenderer`, `IPCatalogPanel`, `PropertiesPanel`, `PackageIPWizard` |
| `parsers` | 外部格式解析 | `XCIParser`, `IPXACTParser` |
| `utils` | 通用工具 | `uuid.js` |
| `data` | 本地 JSON 数据存储 | `ip_catalog.json`, `interface_templates.json`, `designs/*.json` |

## 3. 核心领域模型

### 3.1 IP Entity（IP 核定义）

IP Entity 是可复用 IP 核的元数据描述，采用 **VLNV**（Vendor:Library:Name:Version）四元组唯一标识，兼容 IP-XACT 标准。

```javascript
class IPEntity {
    vendor: string          // "xilinx.com"
    library: string         // "ip"
    name: string            // "axi_gpio"
    version: string         // "2.0"
    vlnv: string            // "xilinx.com:ip:axi_gpio:2.0" (getter)
    interfaces: Array       // 接口定义（名称、类型、角色、信号）
    parameters: Array       // 参数定义（名称、类型、默认值、范围）
    file_groups: Array      // 文件组（综合、仿真、约束、文档）
    register_map: Object    // 寄存器映射（相对偏移）
}
```

### 3.2 Block Design（块设计）

Block Design 是画布级别的设计容器，包含 IP 实例（Cell）和连接关系（Connection）。

```javascript
class BlockDesign {
    id: string
    name: string
    status: string          // editing / validated / generated / locked
    cells: Array<BDCell>
    connections: Array<BDConnection>
    address_regions: Array<AddressRegion>
}
```

### 3.3 BD Cell（画布单元）

BD Cell 是 Block Design 中的实例，可以是 IP 实例或外部模块引用。

```javascript
class BDCell {
    id: string
    ip_entity_id: string | null
    cell_type: string       // ip_instance / module_reference / hierarchical
    instance_name: string
    position_x: number
    position_y: number
    parameter_overrides: Object
    register_address_map: Object  // { register_name: absolute_address }
}
```

### 3.4 BD Connection（连接关系）

支持接口级连接（Interface）和信号级连接（Signal）两种粒度。

```javascript
class BDConnection {
    id: string
    source_cell_id: string
    target_cell_id: string
    source_interface: string | null
    target_interface: string | null
    source_signal: string | null
    target_signal: string | null
    connection_type: string     // interface / signal / bus
    status: string              // valid / invalid / pending / warning
    validation_messages: Array
}
```

## 4. 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| 前端框架 | 原生 JavaScript ES6 Modules | 零依赖、零构建、双击即可运行 |
| 渲染引擎 | HTML5 Canvas 2D | 直接绘制 Block Design 画布与贝塞尔连线 |
| 样式 | 原生 CSS | 暗色 Vivado 风格主题 |
| 数据存储 | 本地 JSON 文件 | 无需服务器/数据库，Git 友好 |
| 文件读写 | File System Access API + Blob 下载 | Chrome 直接保存，其他浏览器回退下载 |
| 解析器 | 原生 DOMParser + 字符串解析 | XCI/IP-XACT 轻量解析 |

## 5. 数据流

```
本地 JSON 文件
    → FileStorage.load() / loadDesign()
    → Service 层（IPCatalogService / BlockDesignService）
    → Component 渲染（CanvasRenderer / IPCatalogPanel / PropertiesPanel）
    → 用户交互
    → Service 修改内存对象
    → FileStorage.save() / saveDesign()
    → 本地 JSON 文件写入
```

## 6. 关键设计决策

### 6.1 本地 JSON 文件存储

- 所有 IP 定义、接口模板、设计文件均保存在项目 `data/` 目录下
- 采用 `fetch()` 读取初始数据，支持 Open Design 加载外部 JSON
- 保存时优先使用 File System Access API（Chrome/Edge），其他浏览器回退为 Blob 下载
- 无数据库、无迁移，JSON Schema 版本通过 `version` 字段管理

### 6.2 接口抽象层

所有连接操作基于接口（Interface）而非信号（Signal），对标 Vivado IPI 的核心设计哲学：
- AXI4 Master 接口连接 AXI4 Slave 接口时，系统自动处理底层信号映射
- 连接验证在接口级别进行（类型、角色、协议兼容性）
- 大幅降低复杂系统的连接复杂度

### 6.3 VLNV 命名体系

采用 Vendor:Library:Name:Version 四元组作为 IP 唯一标识：
- 兼容 IP-XACT（IEEE 1685）标准
- 支持多供应商、多库、多版本的 IP 共存
- 便于 IP 生态系统的扩展和协作

### 6.4 三层寄存器架构

| 层级 | 存储位置 | 数据格式 | 说明 |
|------|---------|----------|------|
| IP 定义模板 | `ip_catalog.json` → `register_map.registers[].offset` | 相对偏移（如 `0x0000`） | 定义寄存器的偏移地址、位域、权限 |
| 实例绝对地址 | `design.json` → `cells[].register_address_map` | 绝对地址（如 `0x40000000`） | Block Design 为实例分配的寄存器基地址 |
| 地址区域 | `design.json` → `address_regions[].register_map` | 含绝对地址的完整寄存器表 | 地址空间内的完整寄存器定义 |

### 6.5 分层封装（未来扩展）

Block Design 本身可封装为子系统 IP，在更高层 BD 中复用：
- 支持无限层次嵌套
- 参数在层次间传播
- 地址映射在封装时自动聚合

> 注：分层封装与参数传播为后续版本功能，v1.0.0 仅提供基础数据模型支持。

## 7. 参考对标

| 自研功能 | Vivado IPI 对标 | 状态 |
|---------|----------------|------|
| IP Catalog | IP Catalog | ✅ 已实现 |
| Block Design | Block Design Canvas | ✅ 已实现（Canvas 渲染） |
| 接口连接 | Interface Connection | ✅ 已实现 |
| 智能自动连接 | Connection Automation | ⚠️ 基础实现（同类型 Master→Slave） |
| IP Packager | IP Packager | ✅ 已实现（JSON 输出） |
| Tcl 脚本导出 | write_bd_tcl | ✅ 已实现 |
| DRC 引擎 | Design Rule Checking | ⚠️ 基础验证 |
| 地址映射 | Address Map | ⚠️ 数据模型与验证已具备，编辑 UI 待完善 |
| 参数配置 GUI | Customization GUI | ✅ 已实现（属性面板 + 模态框） |
| 层次化设计 | Hierarchical Subsystem | 🔄 规划中 |
