# IP Management System

> **硬件IP核集成设计工具** —— 一个受 Vivado IP Integrator (IPI) 启发的纯前端 IP 管理与系统集成工具，直接打开 `index.html` 即可使用，无需后端服务。

## 部署模式：本地文件网页（模式1）

本项目为**纯前端应用**，无需任何服务器、数据库或安装。直接打开 `index.html` 即可加载并编辑本地 JSON 数据文件。

### 快速开始

```bash
# 方式1：直接双击打开 index.html
# 方式2：使用本地服务器（推荐，避免 CORS 限制）
python -m http.server 8000
# 然后访问 http://localhost:8000
```

> 💡 **提示**：推荐使用 Chrome 或 Edge 浏览器以获得最佳的 File System Access API 支持。

## 项目结构

```
IP Management System/
├── index.html                         # 主入口页面
├── css/
│   └── style.css                      # 样式表（暗色 Vivado 主题）
├── src/
│   ├── main.js                        # 应用入口（初始化 + 事件总线）
│   ├── models/                        # 数据模型（JavaScript 类）
│   │   ├── IPEntity.js                # IP 核定义（VLNV + 寄存器映射）
│   │   ├── BlockDesign.js             # Block Design / BDCell / BDConnection / AddressRegion
│   │   └── InterfaceDefinition.js     # 接口定义模板
│   ├── services/                      # 业务逻辑层
│   │   ├── IPCatalogService.js        # IP 目录 CRUD + 搜索
│   │   ├── BlockDesignService.js      # 画布管理 + 连接管理 + DRC 验证
│   │   └── FileStorage.js             # 本地 JSON 文件读写 + Tcl 导出
│   └── components/                    # UI 组件
│       ├── CanvasRenderer.js          # Canvas 画布渲染器（拖拽/缩放/平移/连接）
│       ├── IPCatalogPanel.js          # IP 目录面板 + 导入外部 IP
│       ├── PropertiesPanel.js         # 属性面板 + 参数编辑模态框
│       └── PackageIPWizard.js       # IP 封装向导（6 步流程）
├── data/                              # 示例数据文件
│   ├── ip_catalog.json                # 3 个示例 IP（Zynq PS、AXI GPIO、AXI Interconnect）
│   ├── interface_templates.json       # 5 个接口模板（AXI4/AXI-Lite/Stream/Clock/Reset）
│   └── designs/
│       └── design_1.json              # 示例 Block Design（含连接和地址映射）
├── 01-planning/                       # 开发计划文档
├── 02-docs/                           # 项目文档（研究报告、API 参考、用户手册）
├── AGENTS.md                          # AI 协作指南（项目架构速查）
└── README.md
```

## 技术栈

| 组件 | 选型 | 说明 |
|------|------|------|
| 前端框架 | 原生 JavaScript (ES6 Modules) | 无依赖，零构建工具 |
| 渲染引擎 | HTML5 Canvas 2D | 画布设计渲染（贝塞尔曲线连接） |
| 数据存储 | 本地 JSON 文件 | 通过 `fetch()` / File System Access API 加载/保存 |
| 样式 | 原生 CSS | 暗色主题（Vivado 风格） |
| 浏览器 | Chrome/Edge/Firefox | File System Access API 在 Chrome 中支持最佳 |

## 核心功能

### IP 目录管理
- **浏览与搜索**：左侧面板展示所有 IP，支持分类过滤和关键词搜索
- **查看详情**：点击 IP 弹出模态框，展示完整接口/参数/寄存器表
- **导入外部 IP**：支持导入 `.json` 格式的 IP 定义，自动检测 VLNV 冲突
- **导入外部设计**：通过 Open Design 按钮加载外部 JSON 设计文件

### Block Design 画布
- **IP 实例化**：双击 IP 或拖拽到画布，自动生成唯一实例名
- **移动与选择**：左键拖拽移动 IP，选中后显示蓝色边框
- **画布导航**：滚轮缩放（鼠标中心）、Alt+拖拽/中键平移、Fit 自适应
- **端口连接**：点击端口（小方块）→ 拖动到目标端口 → 自动创建接口连接
- **连接选择**：点击连接线选中（白色高亮），按 Delete 删除
- **自动连接**：选中 Cell 后点击 Auto Connect，按 Master→Slave 自动匹配接口
- **实时验证**：连接绘制后自动验证接口类型和角色兼容性

### 属性面板（右侧）
- **IP 实例属性**：名称、类型、位置坐标
- **参数编辑**：点击参数旁编辑按钮，弹出类型化编辑模态框（bool/数值/字符串）
- **寄存器展示**：完整寄存器表（名称、偏移、位宽、访问权限）和位域定义
- **地址映射**：Block Design 级别的地址分配表

### IP Packager（封装向导）
6 步向导流程将 HDL 设计封装为可重用的 IP 核：
1. **Basic Information**：VLNV 四元组、显示名、描述、分类、标签
2. **HDL Source Files**：添加源文件（支持语法检查），标记 Synthesis/Simulation/Testbench
3. **Interface Definitions**：手动添加接口或从模板（AXI4/AXI-Lite/Stream/Clock/Reset）自动填充信号
4. **Parameters**：配置参数（名称、类型、默认值、数值范围）
5. **Register Map**：定义寄存器（偏移、位宽、权限、复位值）和位域（字段名、位范围）
6. **Preview & Generate**：JSON 预览，一键添加到 IP Catalog

### 设计验证（DRC）
- **连接验证**：接口类型兼容性、角色互补性（Master ↔ Slave）
- **地址冲突检测**：地址区域重叠检测（Error）
- **缺失地址映射**：AXI4-Lite Slave 接口缺少地址分配时警告（Warning）

### 导出与保存
- **Save Design**：导出 JSON 设计文件（File System Access API 或下载）
- **Export Tcl**：生成 Vivado 兼容 Tcl 脚本，动态获取 IP 的 VLNV，包含参数覆盖配置
- **IP 导出**：向导生成的 IP 可保存为 JSON 下载

## 数据文件格式

### IP Catalog (`data/ip_catalog.json`)

```json
{
  "version": "1.0",
  "ips": [
    {
      "id": "uuid",
      "vendor": "xilinx.com",
      "library": "ip",
      "name": "axi_gpio",
      "version": "2.0",
      "display_name": "AXI GPIO",
      "category": "Basic Elements",
      "interfaces": [...],
      "parameters": [...],
      "register_map": {
        "registers": [
          { "name": "GIER", "offset": "0x0000", "width": 32, "access": "RW", ... }
        ]
      }
    }
  ]
}
```

### Block Design (`data/designs/*.json`)

```json
{
  "id": "bd-001",
  "name": "design_1",
  "status": "editing",
  "cells": [...],
  "connections": [...],
  "address_regions": [...]
}
```

## 使用方式

### 1. 浏览 IP 目录
左侧面板显示所有注册的 IP 核，支持按分类和关键词搜索。点击 IP 查看详情，双击或拖拽到画布添加实例。点击 **Import IP** 可导入外部 IP JSON。

### 2. 编辑 Block Design
- **左键拖拽**：移动 IP 实例
- **Alt+拖拽 / 中键**：平移画布
- **滚轮**：缩放画布（以鼠标为中心）
- **点击端口**：按住拖动到目标端口创建连接
- **点击连接线**：选中，按 **Delete** 删除
- **Auto Connect**：选中 Cell 后点击工具栏按钮，自动匹配兼容接口

### 3. 查看/编辑属性
右侧面板显示当前选中 IP 实例的属性：
- 基本信息（名称、VLNV、类型）
- **参数编辑**：点击 ✎ 按钮，弹出类型化编辑对话框（支持 bool/数值范围校验）
- 接口列表
- **寄存器映射**（含绝对地址和位域）

### 4. 封装新 IP
点击工具栏 **Package IP** 打开 6 步向导：
- 从 `data/interface_templates.json` 选择模板自动填充接口信号
- 在 Step 2 点击 **Check Syntax** 检查 Verilog 文件语法
- 第 6 步预览 JSON，点击 Finish 添加到 IP Catalog

### 5. 保存与导出
- **Save Design**：导出 JSON 文件
- **Export Tcl**：生成 Vivado 兼容 Tcl 脚本（含动态 VLNV 和参数覆盖）
- **Validate**：运行 DRC 验证（连接 + 地址冲突）

## 寄存器描述三层架构

| 层级 | 存储位置 | 数据格式 | 说明 |
|------|---------|----------|------|
| IP 定义模板 | `ip_catalog.json` → `register_map.registers[].offset` | 相对偏移（如 `0x0000`） | 定义寄存器的偏移地址、位域、权限 |
| 实例绝对地址 | `design.json` → `cells[].register_address_map` | 绝对地址（如 `0x40000000`） | Block Design 为实例分配的寄存器基地址 |
| 地址区域 | `design.json` → `address_regions[].register_map` | 含绝对地址的完整寄存器表 | 地址空间内的完整寄存器定义 |

## 浏览器兼容性

| 功能 | Chrome/Edge | Firefox | Safari |
|------|------------|---------|--------|
| 基本操作 | ✅ | ✅ | ✅ |
| 文件读取（fetch） | ✅ | ✅ | ✅ |
| 文件下载（Blob） | ✅ | ✅ | ✅ |
| File System Access API（直接保存） | ✅ | ❌ | ❌ |
| 端口连接交互 | ✅ | ✅ | ✅ |
| 参数编辑对话框 | ✅ | ✅ | ✅ |

对于不支持 File System Access API 的浏览器，使用 **下载 JSON 文件** 的方式保存。

## 开发里程碑

### v1.0.0 — 已实现
- ✅ IP Catalog 浏览、搜索、分类过滤
- ✅ Block Design 画布（Canvas 2D 渲染，拖拽/缩放/平移）
- ✅ 端口连接交互（点击端口 → 临时连接线 → 自动创建连接）
- ✅ 连接可选中、删除（Delete 键）
- ✅ 智能 Auto Connect（按角色自动匹配兼容接口）
- ✅ 属性面板（含参数编辑模态框、寄存器表、地址映射）
- ✅ DRC 验证（连接合法性 + 地址冲突检测 + 缺失地址映射警告）
- ✅ IP Packager（6 步向导：基本信息→文件→接口→参数→寄存器→预览）
- ✅ 接口模板自动填充（从 `interface_templates.json`）
- ✅ HDL 文件语法检查（Verilog 基本语法：module/endmodule、括号平衡、字符串闭合）
- ✅ IP 版本管理（实时检测同名 IP 版本冲突）
- ✅ IP 导入外部 JSON
- ✅ Tcl 导出（动态 VLNV + 参数覆盖）

### 后续计划
- 🔄 地址分配编辑器（手动设置 base_address）
- 🔄 信号级连接（非接口级别的 net 连接）
- 🔄 Undo/Redo 历史栈
- 🔄 更多接口模板（AXI DMA、中断控制器等）
- 🔄 IP 升级管理（从旧版本迁移参数覆盖）
- 🔄 设计层次化（Hierarchical Block Design）

## 参考文档

- [AGENTS.md](AGENTS.md) — AI 协作指南（项目架构速查）
- [Vivado IP Integrator 深度研究报告](02-docs/design/vivado-ipi-research-report.md)
- [部署模式分析](02-docs/design/deployment-mode-analysis.md)
- [API 参考](02-docs/api/api-reference.md)（JSON 数据格式）
- [数据库设计](02-docs/design/database-design.md)（JSON 数据结构设计）
- [用户手册](02-docs/user-guide/user-guide.md)

## 许可证

MIT License
