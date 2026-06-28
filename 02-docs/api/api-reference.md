# IP Management System API 参考文档

## 概述

IP Management System 提供 RESTful API 用于管理硬件 IP 核和 Block Design 画布设计。

所有 API 前缀为 `/api/v1/`。

## 认证

未来版本将支持 JWT Token 认证：
```
Authorization: Bearer <token>
```

## IP Catalog API

### 创建 IP 实体

```http
POST /api/v1/catalog
Content-Type: application/json

{
  "vendor": "xilinx.com",
  "library": "ip",
  "name": "axi_gpio",
  "version": "2.0",
  "display_name": "AXI GPIO",
  "description": "General Purpose I/O",
  "category": "Basic Elements",
  "tags": ["gpio", "axi"],
  "interfaces": [
    {
      "name": "S_AXI",
      "type": "axi4_lite",
      "role": "slave",
      "signals": [
        {"name": "AWADDR", "direction": "input", "width": 32}
      ]
    }
  ],
  "parameters": [
    {
      "name": "C_GPIO_WIDTH",
      "type": "long",
      "default": 32,
      "range": {"min": 1, "max": 32}
    }
  ],
  "file_groups": [
    {"type": "synthesis", "files": ["axi_gpio.v"]}
  ],
  "register_map": {
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
      },
      {
        "name": "IP_IER",
        "offset": "0x0004",
        "width": 32,
        "access": "RW",
        "reset_value": "0x00000000",
        "description": "IP Interrupt Enable Register"
      }
    ]
  }
}
```

### 查询 IP 实体列表

```http
GET /api/v1/catalog?category=Basic%20Elements&status=active&search=gpio
```

**查询参数**：
- `category` (可选): 按分类过滤
- `status` (可选): 按状态过滤（draft/active/deprecated/archived）
- `search` (可选): 按名称/显示名称/描述搜索

### 获取 IP 实体详情

```http
GET /api/v1/catalog/{ip_id}
```

### 更新 IP 实体

```http
PATCH /api/v1/catalog/{ip_id}
Content-Type: application/json

{
  "description": "Updated description",
  "status": "active",
  "interfaces": [...],
  "parameters": [...]
}
```

### 删除 IP 实体

```http
DELETE /api/v1/catalog/{ip_id}
```

## Block Design API

### 创建 Block Design

```http
POST /api/v1/designs
Content-Type: application/json

{
  "name": "design_1",
  "description": "Zynq base system with GPIO"
}
```

### 查询 Block Design 列表

```http
GET /api/v1/designs
```

### 获取 Block Design 详情

```http
GET /api/v1/designs/{bd_id}
```

### 删除 Block Design

```http
DELETE /api/v1/designs/{bd_id}
```

## Cell 操作 API

### 添加 IP 实例

```http
POST /api/v1/designs/{bd_id}/cells
Content-Type: application/json

{
  "ip_entity_id": "uuid",
  "cell_type": "ip_instance",
  "instance_name": "gpio_0",
  "position_x": 100.0,
  "position_y": 200.0,
  "parameter_overrides": {
    "C_GPIO_WIDTH": 16
  },
  "register_address_map": {
    "GIER": 0x40000000,
    "IP_IER": 0x40000004
  }
}
```

### 添加模块引用

```http
POST /api/v1/designs/{bd_id}/cells
Content-Type: application/json

{
  "cell_type": "module_reference",
  "instance_name": "my_module_0",
  "module_reference": "rtl/my_module.v",
  "position_x": 300.0,
  "position_y": 400.0
}
```

### 查询 Cell 列表

```http
GET /api/v1/designs/{bd_id}/cells
```

### 移动 Cell

```http
PATCH /api/v1/designs/cells/{cell_id}/move
Content-Type: application/json

{
  "x": 500.0,
  "y": 300.0
}
```

### 删除 Cell

```http
DELETE /api/v1/designs/cells/{cell_id}
```

## Connection API

### 创建接口连接

```http
POST /api/v1/designs/{bd_id}/connections
Content-Type: application/json

{
  "source_cell_id": "uuid",
  "source_interface": "M_AXI_GP0",
  "target_cell_id": "uuid",
  "target_interface": "S00_AXI",
  "connection_type": "interface"
}
```

### 创建信号连接

```http
POST /api/v1/designs/{bd_id}/connections
Content-Type: application/json

{
  "source_cell_id": "uuid",
  "source_signal": "clk_100mhz",
  "target_cell_id": "uuid",
  "target_signal": "aclk",
  "connection_type": "signal"
}
```

### 查询连接列表

```http
GET /api/v1/designs/{bd_id}/connections
```

### 删除连接

```http
DELETE /api/v1/designs/connections/{conn_id}
```

## 响应格式

### 成功响应

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "axi_gpio",
  "vlnv": "xilinx.com:ip:axi_gpio:2.0",
  "status": "active"
}
```

### 错误响应

```json
{
  "detail": "IP entity not found"
}
```

## 状态码

| HTTP 状态码 | 含义 |
|------------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 204 | 删除成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如 VLNV 重复） |
| 500 | 服务器内部错误 |
