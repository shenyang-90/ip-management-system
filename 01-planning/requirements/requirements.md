# 功能需求文档

## 1. IP Catalog（IP 目录管理）

### 1.1 IP 仓库管理
- **IP 注册**：导入 IP 定义（支持 IP-XACT XML、自定义 JSON）
- **IP 元数据**：名称、描述、供应商(Vendor)、库(Library)、版本(Version)
- **VLNV 标识**：Vendor:Library:Name:Version 四元组全局唯一标识
- **IP 分类**：按功能分类（Basic Elements / Communication / DSP / Embedded / Memory / Math / UserIP）
- **IP 标签**：支持自定义标签，便于搜索过滤
- **兼容性**：支持器件系列、工具版本兼容性声明
- **IP 状态**：Draft / Active / Deprecated / Archived

### 1.2 接口定义管理
- **接口类型**：AXI4、AXI4-Lite、AXI4-Stream、APB、Clock、Reset、Interrupt、Custom
- **接口角色**：Master / Slave / Monitor / Bi-directional
- **信号定义**：每个接口包含信号列表（名称、方向、位宽、描述）
- **关联接口**：接口与时钟、复位、总线的关联关系（ASSOCIATED_BUSIF、ASSOCIATED_CLK）
- **自定义接口**：支持创建自定义接口定义

### 1.3 参数配置系统
- **参数定义**：名称、显示名称、类型(Long/Float/Bool/BitString/String)、默认值
- **参数范围**：最小值、最大值、枚举值列表
- **可见性控制**：Always Visible / Hidden / Conditional（依赖其他参数）
- **表达式支持**：参数值可基于其他参数计算

### 1.4 文件组管理
- **Synthesis**：综合用 HDL 文件
- **Simulation**：仿真用文件
- **Constraints**：约束文件（XDC）
- **Documentation**：文档、数据手册
- **Drivers**：软件驱动
- **Example Design**：示例设计

## 2. Block Design（块设计）

### 2.1 画布设计
- **创建/删除 BD**：每个 BD 有唯一名称和版本
- **画布状态**：Editing / Validated / Generated / Locked
- **IP 实例化**：从 IP Catalog 拖拽/选择实例化到画布
- **模块引用**：引用外部 RTL 模块（Module Reference）
- **画布布局**：自动布局、手动调整位置

### 2.2 连接管理
- **接口连接**：连接两个兼容的接口（自动匹配 Master/Slave）
- **信号连接**：点对点信号连接
- **总线连接**：多点到多点总线连接
- **连接可视化**：已连接/未连接状态区分、兼容性提示
- **连接断开**：支持断开已有连接

### 2.3 智能自动连接（Connection Automation）
- **接口自动匹配**：识别兼容的 Master/Slave 接口对
- **Interconnect 自动插入**：AXI 接口自动插入 AXI Interconnect / SmartConnect
- **时钟自动连接**：自动连接同源时钟信号
- **复位自动连接**：自动连接复位信号
- **中断自动连接**：自动路由到中断控制器
- **地址自动分配**：自动分配地址空间，避免冲突

### 2.4 参数配置
- **实例参数覆盖**：每个 IP 实例可覆盖默认参数
- **参数传播**：父级参数变更自动向下传播
- **参数验证**：实时验证参数合法性

### 2.5 地址映射（Address Map）
- **地址区域**：定义每个 Slave 接口的地址范围
- **地址分配**：自动分配不重叠地址
- **地址冲突检测**：检测地址重叠并告警
- **地址段查看**：总览所有地址分配

## 3. IP Packager（IP 封装）

### 3.1 封装向导
- **源选择**：从当前项目、Block Design、AXI 外设模板创建
- **标识信息**：VLNV、显示名称、描述、分类
- **兼容性**：支持器件系列选择
- **参数配置**：选择暴露哪些参数到顶层
- **接口映射**：端口到接口的映射
- **文件组**：组织综合、仿真、约束文件

### 3.2 输出产物
- **IP-XACT XML**：component.xml 标准描述文件
- **GUI 定制**：xgui 参数配置界面
- **HDL Wrapper**：顶层封装文件
- **仿真模型**：仿真用网表或模型
- **约束文件**：时序和物理约束

## 4. 设计验证与DRC

### 4.1 设计规则检查
- **必需接口连接**：检查必需接口是否已连接
- **时钟匹配**：检查时钟频率兼容性
- **位宽匹配**：检查数据位宽一致性
- **地址冲突**：检查地址空间重叠
- **复位极性**：检查复位极性一致性
- **版本兼容性**：检查IP版本兼容性

### 4.2 设计验证
- **Validate Design**：验证整个 Block Design 的完整性
- **错误/警告/信息**：三级消息分类
- **画布高亮**：错误位置在画布上高亮显示

## 5. 脚本与自动化

### 5.1 Tcl 脚本导出
- **write_bd_tcl**：导出整个 Block Design 的 Tcl 脚本
- **脚本可复现**：导出的脚本可在任意环境重新创建设计
- **增量导出**：支持仅导出变更部分

### 5.2 输出产物生成
- **Generate Output Products**：生成综合、仿真、实现所需文件
- **OOC 综合**：支持 Out-of-Context 独立综合
- **HDL Wrapper**：生成顶层 HDL 封装
- **地址头文件**：生成 C/C++ 地址定义头文件

## 6. 系统管理

- **用户与权限**：基于角色的访问控制（RBAC）
- **项目隔离**：多项目支持，项目间资源隔离
- **版本控制**：设计版本历史与回滚
- **审计日志**：操作记录与追溯
