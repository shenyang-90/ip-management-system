# 数据库设计

## 实体关系图 (ERD)

```
┌────────────────────────────┐         ┌────────────────────────────┐
│       ip_entity            │         │  interface_definition       │
├────────────────────────────┤         ├────────────────────────────┤
│ id (PK)                    │         │ id (PK)                     │
│ vendor                     │         │ name                        │
│ library                    │         │ version                     │
│ name                       │         │ interface_type              │
│ version                    │         │ role                        │
│ display_name               │         │ description                 │
│ description                │         │ signals (JSON)              │
│ category                   │         │ metadata (JSON)             │
│ tags (JSON)                │         │ created_at                  │
│ status                     │         │ updated_at                  │
│ compatibility (JSON)       │         └────────────────────────────┘
│ interfaces (JSON)          │
│ parameters (JSON)          │
│ file_groups (JSON)         │
│ created_at                 │
│ updated_at                 │
└────────────┬───────────────┘
             │ 1 : N
             ▼
┌────────────────────────────┐         ┌────────────────────────────┐
│         bd_cell            │         │      block_design           │
├────────────────────────────┤         ├────────────────────────────┤
│ id (PK)                    │◄───────│ id (PK)                     │
│ block_design_id (FK)       │    N:1 │ name (UQ)                   │
│ ip_entity_id (FK)          │◄───────│ description                 │
│ cell_type                  │   N:1  │ status                      │
│ instance_name              │        │ canvas_data (JSON)          │
│ position_x                 │        │ created_at                  │
│ position_y                 │        │ updated_at                  │
│ parameter_overrides (JSON) │        └────────────────────────────┘
│ module_reference           │
│ created_at                 │
│ updated_at                 │
└────────────┬───────────────┘
             │ 1 : N
             ▼
┌────────────────────────────┐         ┌────────────────────────────┐
│      bd_connection         │         │    address_region           │
├────────────────────────────┤         ├────────────────────────────┤
│ id (PK)                    │         │ id (PK)                     │
│ block_design_id (FK)       │         │ block_design_id (FK)        │
│ source_cell_id (FK)        │         │ cell_id (FK)                │
│ source_interface           │         │ interface_name              │
│ source_signal              │         │ base_address                │
│ target_cell_id (FK)        │         │ high_address                │
│ target_interface           │         │ size                        │
│ target_signal              │         │ address_space               │
│ connection_type            │         │ created_at                  │
│ status                     │         │ updated_at                  │
│ validation_messages (JSON) │         └────────────────────────────┘
│ metadata (JSON)            │
│ created_at                 │
│ updated_at                 │
└────────────────────────────┘
```

## 表结构

### ip_entity（IP 核定义）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| vendor | VARCHAR(128) | 供应商（如 xilinx.com） |
| library | VARCHAR(128) | 库名（如 ip, user） |
| name | VARCHAR(256) | IP 名称 |
| version | VARCHAR(64) | 版本号 |
| display_name | VARCHAR(256) | 显示名称 |
| description | TEXT | 描述 |
| category | VARCHAR(256) | 分类（如 DSP, Memory, Communication） |
| tags | JSONB | 标签数组 |
| status | VARCHAR(16) | 状态：draft/active/deprecated/archived |
| compatibility | JSONB | 兼容性信息（器件系列、工具版本） |
| interfaces | JSONB | 接口定义列表（名称、类型、角色、信号） |
| parameters | JSONB | 参数定义列表（名称、类型、默认值、范围） |
| file_groups | JSONB | 文件组（综合、仿真、约束、文档） |
| **register_map** | **JSONB** | **寄存器映射描述（寄存器列表、偏移、位域、访问权限）** |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

**唯一约束**：(vendor, library, name, version) → VLNV 全局唯一

### register_map 数据结构示例

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

### interface_definition（接口定义模板）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | VARCHAR(128) | 接口名称 |
| version | VARCHAR(32) | 版本 |
| interface_type | VARCHAR(32) | 类型：axi4/axi4_lite/axi4_stream/apb/clock/reset/interrupt/custom |
| role | VARCHAR(16) | 角色：master/slave/monitor/bidirectional |
| description | TEXT | 描述 |
| signals | JSONB | 信号列表（名称、方向、位宽、描述） |
| metadata | JSONB | 元数据 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

**唯一约束**：(name, version)

### block_design（块设计画布）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | VARCHAR(256) | 设计名称（唯一） |
| description | TEXT | 描述 |
| status | VARCHAR(16) | 状态：editing/validated/generated/locked |
| canvas_data | JSONB | 画布数据（视口、缩放、网格） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### bd_cell（画布中的单元实例）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| block_design_id | UUID | 所属 BD（FK → block_design） |
| ip_entity_id | UUID | 引用的 IP 定义（FK → ip_entity，可为空） |
| cell_type | VARCHAR(32) | 类型：ip_instance/module_reference/hierarchical |
| instance_name | VARCHAR(256) | 实例名称（在 BD 内唯一） |
| position_x | FLOAT | 画布 X 坐标 |
| position_y | FLOAT | 画布 Y 坐标 |
| parameter_overrides | JSONB | 参数覆盖值 |
| **register_address_map** | **JSONB** | **实例级寄存器绝对地址映射 { "register_name": absolute_address, ... }** |
| module_reference | VARCHAR(512) | 外部模块路径（模块引用时） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

**唯一约束**：(block_design_id, instance_name)

### bd_connection（连接关系）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| block_design_id | UUID | 所属 BD（FK） |
| source_cell_id | UUID | 源单元（FK → bd_cell） |
| source_interface | VARCHAR(256) | 源接口名 |
| source_signal | VARCHAR(256) | 源信号名 |
| target_cell_id | UUID | 目标单元（FK → bd_cell） |
| target_interface | VARCHAR(256) | 目标接口名 |
| target_signal | VARCHAR(256) | 目标信号名 |
| connection_type | VARCHAR(16) | 类型：interface/signal/bus |
| status | VARCHAR(16) | 验证状态：valid/invalid/pending/warning |
| validation_messages | JSONB | DRC 验证消息 |
| metadata | JSONB | 元数据（如 auto-generated） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### address_region（地址映射区域）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| block_design_id | UUID | 所属 BD（FK） |
| cell_id | UUID | 目标单元（FK → bd_cell） |
| interface_name | VARCHAR(256) | 接口名称 |
| base_address | BIGINT | 起始地址 |
| high_address | BIGINT | 结束地址 |
| size | BIGINT | 区域大小 |
| address_space | VARCHAR(128) | 地址空间名称（如 Data, AXI_Lite） |
| **register_map** | **JSONB** | **该地址区域内的寄存器映射描述（继承自 ip_entity 的寄存器定义，含绝对地址）** |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

## 索引设计

- `ip_entity`: (category), (status), (name), (vendor, library, name, version) UNIQUE
- `interface_definition`: (name, version) UNIQUE
- `block_design`: (name) UNIQUE, (status)
- `bd_cell`: (block_design_id), (block_design_id, instance_name) UNIQUE
- `bd_connection`: (block_design_id), (source_cell_id), (target_cell_id)
- `address_region`: (block_design_id), (cell_id)

## 设计决策说明

### 1. JSONB 字段用于嵌套数据

interfaces、parameters、file_groups 等字段使用 JSONB 存储，因为：
- 结构高度嵌套，关系表建模成本过高
- 读多写少，查询时通常整体读取
- 未来扩展灵活，无需修改表结构
- PostgreSQL JSONB 支持索引和查询

### 2. VLNV 唯一标识

采用 Vendor:Library:Name:Version 四元组作为 IP 唯一标识，兼容 IP-XACT 标准。

### 3. 连接表设计

bd_connection 同时支持 interface 和 signal 两种连接粒度，通过 nullable 字段区分：
- interface 连接：source_interface/target_interface 有值
- signal 连接：source_signal/target_signal 有值

### 4. 参数覆盖与传播

bd_cell.parameter_overrides 存储实例级别的参数覆盖值。参数传播逻辑在应用层实现，通过遍历 bd_cell → ip_entity.parameters → parameter_overrides 计算最终参数值。

### 5. 寄存器映射三层架构

寄存器描述分布在三个层级：
- **ip_entity.register_map**: IP 定义级别的寄存器模板（偏移地址、位域、访问权限）
- **bd_cell.register_address_map**: 实例化后的绝对地址分配（如 `{"GIER": 0x40000000}`）
- **address_region.register_map**: 地址区域内的完整寄存器列表（含绝对偏移后的地址）

这种分层设计使得：
- IP 定义可以独立复用，不绑定具体地址
- Block Design 可以灵活分配寄存器基地址
- 软件驱动可以自动生成地址头文件（类似 Vivado 的 xparameters.h）
