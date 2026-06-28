# 系统架构设计

> **部署模式：本地文件网页（模式1）** —— 纯前端应用，直接打开 index.html 即可使用，无需后端服务。

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
│  │  │  Components: CanvasRenderer, IPCatalogPanel,              │  │  │
│  │  │  PropertiesPanel, Modal dialogs                         │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  Services: IPCatalogService, BlockDesignService,        │  │  │
│  │  │  ConnectionService, FileStorage                       │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  Models: IPEntity, BlockDesign, BDCell, BDConnection,   │  │  │
│  │  │  AddressRegion, InterfaceDefinition                     │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  通过 fetch() 读取本地 JSON 文件  │  通过 File System Access API    │
│  或 <input type="file"> 选择文件  │  直接读写本地文件（Chrome）       │
│                              │                                      │
│  ┌──────────────────────┐  ┌─────────────────────────────────────┐
│  │  data/ip_catalog.json  │  │  data/designs/*.json                 │
│  │  data/interface_       │  │  （IP 定义、设计文件、接口模板）       │
│  │  templates.json        │  │                                      │
│  └──────────────────────┘  └─────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

## 2. 模块划分

| 模块 | 职责 | 核心类 |
|------|------|--------|
| `core` | 配置、依赖注入、异常处理 | `Config`, `AppException`, `get_db` |
| `models` | 数据模型与ORM映射 | `IPEntity`, `BlockDesign`, `BDCell`, `BDConnection`, `AddressRegion`, `InterfaceDefinition` |
| `services` | 业务逻辑 | `IPCatalogService`, `BlockDesignService`, `ConnectionService` |
| `api` | HTTP 路由与请求处理 | `ip_catalog_router`, `block_design_router` |
| `utils` | 工具函数 | `cidr_utils` (legacy), `validators`, `ip_xact_parser` |
| `config` | 环境配置 | `settings`, `database`, `logging` |

## 3. 核心领域模型

### 3.1 IP Entity（IP 核定义）

IP Entity 是可复用 IP 核的元数据描述，采用 **VLNV**（Vendor:Library:Name:Version）四元组唯一标识，兼容 IP-XACT 标准。

```python
class IPEntity:
    vendor: str          # "xilinx.com"
    library: str         # "ip"
    name: str            # "axi_gpio"
    version: str         # "2.0"
    vlnv: str            # "xilinx.com:ip:axi_gpio:2.0"
    interfaces: list[dict]   # 接口定义（名称、类型、角色、信号）
    parameters: list[dict]   # 参数定义（名称、类型、默认值、范围）
    file_groups: list[dict]  # 文件组（综合、仿真、约束、文档）
```

### 3.2 Block Design（块设计）

Block Design 是画布级别的设计容器，包含 IP 实例（Cell）和连接关系（Connection）。

```python
class BlockDesign:
    name: str
    status: str          # editing / validated / generated / locked
    cells: list[BDCell]
    connections: list[BDConnection]
    address_regions: list[AddressRegion]
```

### 3.3 BD Cell（画布单元）

BD Cell 是 Block Design 中的实例，可以是 IP 实例或外部模块引用。

```python
class BDCell:
    block_design_id: UUID
    ip_entity_id: UUID | None
    cell_type: str       # ip_instance / module_reference / hierarchical
    instance_name: str
    position_x: float
    position_y: float
    parameter_overrides: dict
```

### 3.4 BD Connection（连接关系）

支持接口级连接（Interface）和信号级连接（Signal）两种粒度。

```python
class BDConnection:
    block_design_id: UUID
    source_cell_id: UUID
    target_cell_id: UUID
    source_interface: str | None
    target_interface: str | None
    connection_type: str     # interface / signal / bus
    status: str              # valid / invalid / pending / warning
```

## 4. 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| Web 框架 | FastAPI | 高性能、自动 OpenAPI、异步支持 |
| ORM | SQLAlchemy 2.0 | 类型安全、原生 asyncio |
| 数据库 | PostgreSQL | 可靠性、JSONB 支持、事务 |
| 迁移 | Alembic | SQLAlchemy 官方配套 |
| 配置 | Pydantic Settings | 类型安全、环境变量支持 |
| 测试 | pytest + pytest-asyncio | 异步测试支持 |
| 容器 | Docker + docker-compose | 一致的环境、易部署 |
| 前端 | (Future) React/Vue + Canvas/SVG | 图形化画布设计 |

## 5. 数据流

```
HTTP Request
    → FastAPI Router (Pydantic 校验/解析)
    → Service (业务逻辑/事务)
    → Repository (ORM 操作)
    → PostgreSQL (JSONB 存储嵌套接口/参数数据)
    → Response (Pydantic 序列化 → JSON)
```

## 6. 关键设计决策

### 6.1 JSONB 存储嵌套数据

interfaces、parameters、file_groups 等字段使用 PostgreSQL JSONB 存储，原因：
- 数据结构高度嵌套，关系表建模成本过高
- 读多写少，查询时通常整体读取
- 未来扩展灵活，无需修改表结构
- PostgreSQL JSONB 支持 GIN 索引和查询

### 6.2 接口抽象层

所有连接操作基于接口（Interface）而非信号（Signal），对标 Vivado IPI 的核心设计哲学：
- AXI4 Master 接口连接 AXI4 Slave 接口时，系统自动处理所有底层信号映射
- 连接验证在接口级别进行（类型、角色、数据位宽匹配）
- 大幅降低复杂系统的连接复杂度

### 6.3 VLNV 命名体系

采用 Vendor:Library:Name:Version 四元组作为 IP 唯一标识：
- 兼容 IP-XACT（IEEE 1685）标准
- 支持多供应商、多库、多版本的 IP 共存
- 便于 IP 生态系统的扩展和协作

### 6.4 分层封装

Block Design 本身可封装为子系统 IP，在更高层 BD 中复用：
- 支持无限层次嵌套
- 参数在层次间传播
- 地址映射在封装时自动聚合

## 7. 参考对标

| 自研功能 | Vivado IPI 对标 | 状态 |
|---------|----------------|------|
| IP Catalog | IP Catalog | ✅ 已实现 |
| Block Design | Block Design Canvas | ✅ 已实现（Canvas 渲染） |
| 接口连接 | Interface Connection | ✅ 已实现 |
| 智能自动连接 | Connection Automation | 🔄 规划中 |
| IP Packager | IP Packager | 🔄 规划中 |
| Tcl 脚本导出 | write_bd_tcl | ✅ 已实现 |
| DRC 引擎 | Design Rule Checking | ✅ 基础验证 |
| 地址映射 | Address Map | ✅ 已实现 |
| 参数配置 | Customization GUI | 🔄 规划中 |
