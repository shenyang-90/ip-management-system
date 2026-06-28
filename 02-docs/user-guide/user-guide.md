# 用户手册

## 概述

IP Management System 是一个面向 FPGA/ASIC 硬件设计的 **IP 核集成管理工具**，对标 Vivado IP Integrator，提供 Web 端的 IP 目录管理、Block Design 画布设计和 IP 封装功能。

## 主要功能

### 1. IP Catalog（IP 目录）

- 浏览和搜索已注册的 IP 核
- 查看 IP 的接口定义、参数配置和文件组
- 按分类、标签、状态筛选 IP
- 导入新的 IP 定义（支持 IP-XACT XML 格式）
- 管理 IP 版本和生命周期

### 2. Block Design（块设计）

- 创建新的 Block Design 画布
- 从 IP Catalog 拖拽/选择实例化 IP
- 添加外部 RTL 模块引用
- 在画布上移动和调整 IP 位置
- 连接 IP 接口（AXI4、AXI-Lite、Clock、Reset 等）
- 查看和管理连接关系
- 分配地址映射空间

### 3. 接口连接

- **接口级连接**：连接两个 IP 的 AXI 接口（如 Master → Slave）
- **信号级连接**：连接单个信号（如时钟、复位）
- **连接验证**：实时检查接口兼容性
- **自动连接**：一键自动连接匹配的接口

### 4. IP Packager（IP 封装）

- 将 Block Design 封装为可复用的 IP
- 定义 VLNV 标识（Vendor:Library:Name:Version）
- 选择暴露的参数和接口
- 导出 IP-XACT 标准描述文件

## 快速入门

### 步骤 1：注册 IP 核

```bash
curl -X POST http://localhost:8000/api/v1/catalog \
  -H "Content-Type: application/json" \
  -d '{
    "vendor": "xilinx.com",
    "library": "ip",
    "name": "axi_gpio",
    "version": "2.0",
    "display_name": "AXI GPIO",
    "category": "Basic Elements",
    "interfaces": [
      {
        "name": "S_AXI",
        "type": "axi4_lite",
        "role": "slave"
      }
    ]
  }'
```

### 步骤 2：创建 Block Design

```bash
curl -X POST http://localhost:8000/api/v1/designs \
  -H "Content-Type: application/json" \
  -d '{"name": "design_1", "description": "My first design"}'
```

### 步骤 3：实例化 IP

```bash
curl -X POST http://localhost:8000/api/v1/designs/{bd_id}/cells \
  -H "Content-Type: application/json" \
  -d '{
    "ip_entity_id": "{ip_id}",
    "instance_name": "gpio_0",
    "position_x": 100,
    "position_y": 200
  }'
```

### 步骤 4：连接接口

```bash
curl -X POST http://localhost:8000/api/v1/designs/{bd_id}/connections \
  -H "Content-Type: application/json" \
  -d '{
    "source_cell_id": "{cell_a}",
    "source_interface": "M_AXI",
    "target_cell_id": "{cell_b}",
    "target_interface": "S_AXI",
    "connection_type": "interface"
  }'
```

## 常见问题

**Q: 什么是 VLNV？**  
A: VLNV 是 Vendor:Library:Name:Version 的缩写，用于全局唯一标识一个 IP 核。例如 `xilinx.com:ip:axi_gpio:2.0`。

**Q: 接口连接和信号连接有什么区别？**  
A: 接口连接是在抽象层面连接两个 IP 的接口（如 AXI4 Master → Slave），系统会自动处理所有底层信号。信号连接是点对点连接单个信号（如时钟线）。

**Q: 如何导入现有的 IP 核？**  
A: 通过 IP Catalog API 的 POST 接口注册 IP 定义，支持直接上传 IP-XACT XML 文件或手动填写 JSON 元数据。

**Q: Block Design 支持哪些接口类型？**  
A: 目前支持 AXI4、AXI4-Lite、AXI4-Stream、APB、Clock、Reset、Interrupt 和自定义接口。

**Q: 设计如何导出为脚本？**  
A: 未来版本将支持 `write_bd_tcl` 等价功能，导出可复现的自动化脚本。
