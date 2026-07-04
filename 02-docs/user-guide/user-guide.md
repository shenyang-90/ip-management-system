# 用户手册

## 概述

IP Management System 是一个面向 FPGA/ASIC 硬件设计的 **纯前端 IP 核集成管理工具**，对标 Vivado IP Integrator。无需后端服务或数据库，直接打开 `index.html` 即可使用。

## 部署方式

### 方式1：直接打开（最简单）

双击或用浏览器打开项目根目录下的 `index.html`。

### 方式2：本地 HTTP 服务器（推荐）

避免浏览器的本地文件 CORS 限制：

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

> 💡 **提示**：推荐使用 Chrome 或 Edge 浏览器以获得最佳的 File System Access API 支持。Firefox/Safari 仍可正常使用，但保存时会以下载 JSON 文件的方式回退。

---

## 主要功能

### 1. IP Catalog（IP 目录）

- 浏览和搜索已注册的 IP 核
- 查看 IP 的接口定义、参数配置、寄存器映射和文件组
- 按分类、关键词筛选 IP
- 导入新的 IP 定义（支持 `.json`、`.xci`、`.xml` IP-XACT 格式）
- IP 版本冲突检测

### 2. Block Design（块设计）

- 创建新的 Block Design 画布
- 从 IP Catalog 拖拽或双击实例化 IP
- 在画布上移动和调整 IP 位置
- 连接 IP 接口（AXI4、AXI4-Lite、Clock、Reset 等）
- 查看和管理连接关系
- 地址映射只读展示（地址分配需手动编辑 JSON）

### 3. 接口连接

- **接口级连接**：连接两个 IP 的接口（如 Master → Slave）
- **信号级连接**：数据模型已支持，UI 待后续版本完善
- **连接验证**：自动检查接口类型和角色兼容性
- **自动连接**：选中 Cell 后点击工具栏 **Auto Connect**，自动匹配同类型 Master/Slave 接口

### 4. IP Packager（IP 封装）

- 通过 6 步向导将 HDL 设计封装为可复用的 IP
- 定义 VLNV 标识（Vendor:Library:Name:Version）
- 添加 HDL 源文件、接口、参数、寄存器映射
- 预览生成的 JSON 并一键添加到 IP Catalog

---

## 快速入门

### 步骤 1：启动应用

直接打开 `index.html`，左侧会显示示例 IP 目录，中间为空白画布。

### 步骤 2：创建或打开设计

- 点击工具栏 **New Design** 创建空白 Block Design
- 或点击 **Open Design** 选择本地 `.json` 设计文件

### 步骤 3：实例化 IP

- 在左侧 IP 目录中双击某个 IP
- 或拖拽 IP 到画布上
- 系统会自动生成唯一实例名（如 `axi_gpio_0`）

### 步骤 4：移动与连接

- **移动 Cell**：左键按住 Cell 拖动
- **平移画布**：按住 `Alt` 键拖动，或按住鼠标中键拖动
- **缩放画布**：滚动鼠标滚轮
- **连接接口**：
  1. 点击源 Cell 右侧的端口小方块
  2. 按住拖动到目标 Cell 左侧的端口
  3. 释放鼠标完成连接
- **删除连接**：点击连接线选中，按 `Delete` 键

### 步骤 5：编辑参数

1. 选中画布上的 Cell
2. 右侧面板显示该实例的属性
3. 在 **Parameters** 区域点击参数旁的编辑按钮
4. 在弹出的模态框中修改值并保存

### 步骤 6：保存与导出

- **Save Design**：将当前设计保存为 JSON 文件
  - Chrome/Edge：如果已选择项目目录，会直接覆盖 `data/designs/{name}.json`
  - 其他浏览器：触发文件下载，需手动替换原文件
- **Export Tcl**：生成 Vivado 兼容的 Tcl 脚本，包含 `create_bd_design`、`create_bd_cell`、`connect_bd_intf_net` 和参数覆盖命令
- **Save IP Catalog**：在 IP Packager 中添加新 IP 后，保存到 `data/ip_catalog.json`

---

## 核心操作流程示例

### 创建 Zynq + AXI GPIO 设计

1. 点击 **New Design**，输入名称 `design_1`
2. 从左侧 IP 目录双击 **Zynq7 Processing System**，放置到画布左侧
3. 双击 **AXI Interconnect**，放置到画布中间
4. 双击 **AXI GPIO**，放置到画布右侧
5. 连接 `ps_0/M_AXI_GP0` → `axi_interconnect_0/S00_AXI`
6. 连接 `axi_interconnect_0/M00_AXI` → `gpio_0/S_AXI`
7. 点击 **Validate** 运行 DRC 验证
8. 点击 **Export Tcl** 导出 Vivado 脚本

---

## 设计验证（DRC）

点击工具栏 **Validate** 按钮，系统会检查：

- **连接合法性**：接口类型是否匹配、角色是否互补（Master ↔ Slave）
- **地址区域重叠**：多个地址区域是否冲突
- **缺失地址映射**：AXI4-Lite Slave 接口是否缺少地址分配

验证结果会显示在底部状态栏。当前版本暂未提供独立的验证报告面板。

---

## IP Packager 使用指南

### 启动向导

点击工具栏 **Package IP** 按钮，打开 6 步封装向导。

### Step 1: Basic Information

填写 VLNV 四元组、显示名、描述、分类和标签。如果 VLNV 已存在，系统会提示版本冲突。

### Step 2: HDL Source Files

- 点击 **Add File** 添加 Verilog/VHDL 源文件
- 标记每个文件的用途（Synthesis / Simulation / Testbench）
- 点击 **Basic Check** 进行简单的 Verilog 模块声明检查
- 如需删除已添加的文件，点击文件行右侧的删除按钮

### Step 3: Interface Definitions

- 手动添加接口并定义信号
- 或从 **Interface Templates** 下拉框选择模板（AXI4 / AXI4-Lite / AXI4-Stream / Clock / Reset），自动填充信号列表

### Step 4: Parameters

添加 IP 参数，支持类型：`bool`、`long`、`int`、`string`。

### Step 5: Register Map

- 添加寄存器，填写偏移地址、位宽、访问权限、复位值
- 在寄存器下添加位域字段，定义 `bit_range` 和访问权限

### Step 6: Preview & Generate

- 预览生成的 JSON
- 点击 **Finish** 添加到 IP Catalog
- 关闭向导后，在左侧 IP 目录中可看到新封装的 IP

---

## 数据文件说明

| 文件 | 用途 | 是否可手动编辑 |
|------|------|--------------|
| `data/ip_catalog.json` | IP 目录 | 可以，但建议通过 IP Packager 或 Import IP 维护 |
| `data/interface_templates.json` | 接口模板库 | 可以 |
| `data/designs/{name}.json` | Block Design 设计文件 | 可以，用于批量调整地址映射等 |

---

## 浏览器兼容性

| 功能 | Chrome/Edge | Firefox | Safari |
|------|------------|---------|--------|
| 基本操作 | ✅ | ✅ | ✅ |
| 文件读取（fetch） | ✅ | ✅ | ✅ |
| 文件下载（Blob） | ✅ | ✅ | ✅ |
| File System Access API（直接保存） | ✅ | ❌ | ❌ |
| 端口连接交互 | ✅ | ✅ | ✅ |
| 参数编辑对话框 | ✅ | ✅ | ✅ |

---

## 常见问题

**Q: 什么是 VLNV？**  
A: VLNV 是 Vendor:Library:Name:Version 的缩写，用于全局唯一标识一个 IP 核。例如 `xilinx.com:ip:axi_gpio:2.0`。

**Q: 接口连接和信号连接有什么区别？**  
A: 接口连接是在抽象层面连接两个 IP 的接口（如 AXI4 Master → Slave），系统会自动处理所有底层信号。信号连接是点对点连接单个信号（如时钟线）。当前版本数据模型已支持信号级连接，但 UI 尚未完善。

**Q: 如何导入现有的 IP 核？**  
A: 点击左侧 **Import IP** 按钮，选择 `.json`、`.xci` 或 `.xml`（IP-XACT）文件。系统会自动解析并追加到 IP Catalog。

**Q: Block Design 支持哪些接口类型？**  
A: 目前支持 AXI4、AXI4-Lite、AXI4-Stream、Clock、Reset 和自定义接口。

**Q: 设计如何导出为脚本？**  
A: 点击工具栏 **Export Tcl** 按钮，生成 Vivado 兼容的 Tcl 脚本，可直接在 Vivado 中运行复现当前 Block Design。

**Q: 保存设计后为什么看不到最新内容？**  
A: 在非 Chrome/Edge 浏览器中，保存会触发文件下载。需要将下载的 `.json` 文件手动移动到项目对应的 `data/designs/` 目录下并覆盖原文件。Chrome/Edge 中若已选择项目根目录，则会直接保存到正确位置。
