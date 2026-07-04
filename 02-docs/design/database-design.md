# 数据结构设计

> 当前版本采用**本地 JSON 文件**存储，无数据库。本文档描述 JSON 文件中的逻辑数据模型与 schema 设计。
> 若未来迁移到 Web 服务端（模式3），可将本文档中的 JSON 对象映射为 PostgreSQL 表 + JSONB 字段。

## 逻辑数据模型

```
┌────────────────────────────┐         ┌────────────────────────────┐
│       ip_entity            │         │  interface_template         │
├────────────────────────────┤         ├────────────────────────────┤
│ id                         │         │ name                        │
│ vendor                     │         │ interface_type              │
│ library                    │         │ role                        │
│ name                       │         │ description                 │
│ version                    │         │ signals                     │
│ display_name               │         └────────────────────────────┘
│ description                │
│ category                   │
│ tags                       │
│ status                     │
│ compatibility              │
│ interfaces                 │
│ parameters                 │
│ file_groups                │
│ register_map               │
└────────────┬───────────────┘
             │ 1 : N
             ▼
┌────────────────────────────┐         ┌────────────────────────────┐
│         bd_cell            │         │      block_design           │
├────────────────────────────┤         ├────────────────────────────┤
│ id                         │◄───────│ id                          │
│ block_design_id            │    N:1 │ name                        │
│ ip_entity_id               │◄───────│ description                 │
│ cell_type                  │   N:1  │ status                      │
│ instance_name              │        │ canvas_data                 │
│ position_x                 │        └────────────────────────────┘
│ position_y                 │
│ parameter_overrides        │
│ register_address_map       │
│ module_reference           │
└────────────┬───────────────┘
             │ 1 : N
             ▼
┌────────────────────────────┐         ┌────────────────────────────┐
│      bd_connection         │         │    address_region           │
├────────────────────────────┤         ├────────────────────────────┤
│ id                         │         │ id                          │
│ block_design_id            │         │ block_design_id             │
│ source_cell_id             │         │ cell_id                     │
│ source_interface           │         │ interface_name              │
│ source_signal              │         │ base_address                │
│ target_cell_id             │         │ high_address                │
│ target_interface           │         │ size                        │
│ target_signal              │         │ address_space               │
│ connection_type            │         │ register_map                │
│ status                     │         └────────────────────────────┘
│ validation_messages        │
│ metadata                   │
└────────────────────────────┘
```

## 文件组织

| 文件路径 | 存储内容 | 对应逻辑模型 |
|---------|---------|------------|
| `data/ip_catalog.json` | IP 定义数组 | `ip_entity` |
| `data/interface_templates.json` | 接口模板数组 | `interface_template` |
| `data/designs/{name}.json` | 单个 Block Design | `block_design` + 嵌入的 `bd_cell` / `bd_connection` / `address_region` |

## JSON Schema

### `ip_entity`（IP 核定义）

存储位置：`data/ip_catalog.json` → `ips[]`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | 全局唯一标识 |
| vendor | string | 供应商（如 `xilinx.com`） |
| library | string | 库名（如 `ip`, `user`） |
| name | string | IP 名称 |
| version | string | 版本号 |
| display_name | string | 显示名称 |
| description | string | 描述 |
| category | string | 分类（如 `Basic Elements`） |
| tags | string[] | 标签数组 |
| status | string | 状态：`draft` / `active` / `deprecated` / `archived` |
| compatibility | object | 兼容性信息（器件系列、工具版本） |
| interfaces | object[] | 接口定义列表（名称、类型、角色、信号） |
| parameters | object[] | 参数定义列表（名称、类型、默认值、范围） |
| file_groups | object[] | 文件组（综合、仿真、约束、文档） |
| register_map | object | 寄存器映射描述（寄存器列表、偏移、位域、访问权限） |

**唯一约束**：(vendor, library, name, version) → VLNV 全局唯一

### `register_map` 数据结构示例

```json
{
  "registers": [
    {
      "name": "GIER",
      "offset": "0x0000",
      "width": 32,
      "access": "RW",
      "reset_value": "0x00000000",
      "description": "Global Interrupt Enable Register",
      "fields": [
        {
          "name": "GIE",
          "bit_range": [0, 0],
          "access": "RW",
          "description": "Global Interrupt Enable"
        }
      ]
    }
  ]
}
```

### `interface_template`（接口定义模板）

存储位置：`data/interface_templates.json` → `templates[]`

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 接口名称 |
| interface_type | string | 类型：`axi4` / `axi4_lite` / `axi4_stream` / `clock` / `reset` / `interrupt` / `custom` |
| role | string | 角色：`master` / `slave` / `monitor` / `bidirectional` |
| description | string | 描述 |
| signals | object[] | 信号列表（名称、方向、位宽、描述） |

### `block_design`（块设计画布）

存储位置：`data/designs/{name}.json`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | 全局唯一标识 |
| name | string | 设计名称（唯一） |
| description | string | 描述 |
| status | string | 状态：`editing` / `validated` / `generated` / `locked` |
| canvas_data | object | 画布数据（视口、缩放、网格） |
| cells | object[] | 嵌入的 `bd_cell` 数组 |
| connections | object[] | 嵌入的 `bd_connection` 数组 |
| address_regions | object[] | 嵌入的 `address_region` 数组 |

### `bd_cell`（画布中的单元实例）

嵌入在 `block_design.cells[]` 中。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | 全局唯一标识 |
| ip_entity_id | string \| null | 引用的 IP 定义 ID |
| cell_type | string | 类型：`ip_instance` / `module_reference` / `hierarchical` |
| instance_name | string | 实例名称（在 BD 内唯一） |
| position_x | number | 画布 X 坐标 |
| position_y | number | 画布 Y 坐标 |
| parameter_overrides | object | 参数覆盖值 `{ param_name: value }` |
| register_address_map | object | 实例级寄存器绝对地址映射 `{ "register_name": absolute_address }` |
| module_reference | string | 外部模块路径（模块引用时） |

**唯一约束**：(block_design_id, instance_name)

### `bd_connection`（连接关系）

嵌入在 `block_design.connections[]` 中。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | 全局唯一标识 |
| source_cell_id | string | 源单元 ID |
| source_interface | string \| null | 源接口名 |
| source_signal | string \| null | 源信号名 |
| target_cell_id | string | 目标单元 ID |
| target_interface | string \| null | 目标接口名 |
| target_signal | string \| null | 目标信号名 |
| connection_type | string | 类型：`interface` / `signal` / `bus` |
| status | string | 验证状态：`valid` / `invalid` / `pending` / `warning` |
| validation_messages | object[] | DRC 验证消息 |
| metadata | object | 元数据（如 `auto-generated`） |

### `address_region`（地址映射区域）

嵌入在 `block_design.address_regions[]` 中。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | 全局唯一标识 |
| cell_id | string | 目标单元 ID |
| interface_name | string | 接口名称 |
| base_address | number | 起始地址 |
| high_address | number | 结束地址 |
| size | number | 区域大小 |
| address_space | string | 地址空间名称（如 `Data`, `AXI_Lite`） |
| register_map | object | 该地址区域内的寄存器映射描述（含绝对地址） |

## 索引与查询策略

在 JSON 文件模式下，查询通过内存中的数组过滤实现：

- **IP Catalog 搜索**：遍历 `ip_catalog.json` 的 `ips` 数组，按 `name` / `category` / `tags` / `status` 过滤
- **VLNV 查找**：构建 Map `(vendor, library, name, version) → ip_entity`
- **Cell 查找**：构建 Map `cell_id → bd_cell`
- **连接级联删除**：删除 Cell 时扫描 `connections` 和 `address_regions` 数组

若未来迁移到 PostgreSQL，建议保留以下索引：

- `ip_entity`: (category), (status), (name), (vendor, library, name, version) UNIQUE
- `block_design`: (name) UNIQUE, (status)
- `bd_cell`: (block_design_id), (block_design_id, instance_name) UNIQUE
- `bd_connection`: (block_design_id), (source_cell_id), (target_cell_id)
- `address_region`: (block_design_id), (cell_id)

## 设计决策说明

### 1. 嵌套数据直接嵌入 JSON

`interfaces`、`parameters`、`file_groups`、`register_map` 等字段直接以 JSON 对象/数组形式存储：
- 结构高度嵌套，关系表建模成本过高
- 读多写少，查询时通常整体读取
- 未来扩展灵活，无需修改 schema
- 当前无数据库，天然适合 JSON 文件

### 2. VLNV 唯一标识

采用 Vendor:Library:Name:Version 四元组作为 IP 唯一标识，兼容 IP-XACT 标准。

### 3. 连接表设计

`bd_connection` 同时支持 `interface` 和 `signal` 两种连接粒度，通过 nullable 字段区分：
- interface 连接：`source_interface` / `target_interface` 有值
- signal 连接：`source_signal` / `target_signal` 有值

### 4. 参数覆盖与传播

`bd_cell.parameter_overrides` 存储实例级别的参数覆盖值。参数传播逻辑在应用层实现，通过遍历 `bd_cell` → `ip_entity.parameters` → `parameter_overrides` 计算最终参数值。

### 5. 寄存器映射三层架构

寄存器描述分布在三个层级：
- **`ip_entity.register_map`**: IP 定义级别的寄存器模板（偏移地址、位域、访问权限）
- **`bd_cell.register_address_map`**: 实例化后的绝对地址分配（如 `{"GIER": 0x40000000}`）
- **`address_region.register_map`**: 地址区域内的完整寄存器列表（含绝对偏移后的地址）

这种分层设计使得：
- IP 定义可以独立复用，不绑定具体地址
- Block Design 可以灵活分配寄存器基地址
- 软件驱动可以自动生成地址头文件（类似 Vivado 的 `xparameters.h`）
