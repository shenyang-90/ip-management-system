# 开发计划

## 项目信息
- **项目名称**: IP Management System
- **项目定位**: 硬件 IP 核集成设计工具（Web 版 Vivado IP Integrator）
- **开始日期**: 2025-06-28
- **目标版本**: v1.0.0
- **部署模式**: 模式1 — 本地文件网页（纯前端，无需后端）
- **技术栈**: 原生 JavaScript ES6 Modules, HTML5 Canvas 2D, 原生 CSS, 本地 JSON 文件

## 阶段规划

### Phase 1: 基础架构 (Week 1-2)
- [x] 项目目录结构（index.html / css / src / data / docs）
- [x] 基础数据模型（`IPEntity`, `BDCell`, `BDConnection`, `AddressRegion`）
- [x] 本地 JSON 数据文件（`ip_catalog.json`, `interface_templates.json`, `designs/design_1.json`）
- [x] 基础样式（暗色 Vivado 主题）
- [x] 应用入口与组件初始化（`src/main.js`）

### Phase 2: IP Catalog 核心 (Week 3-4)
- [x] IP 目录 CRUD 管理（`IPCatalogService`）
- [x] 接口定义模板（`data/interface_templates.json`）
- [x] 参数配置系统（类型、默认值、范围、enum）
- [x] IP 分类与搜索
- [x] VLNV 版本管理与冲突检测
- [x] IP 导入（JSON / XCI / IP-XACT XML）

### Phase 3: Block Design 画布 (Week 5-7)
- [x] Block Design CRUD（`BlockDesignService`）
- [x] IP 实例化（Cell / Instance）
- [x] 接口级连接（Interface Connection）
- [x] 信号级连接数据模型（Signal Connection，UI 待完善）
- [x] 基础自动连接引擎（Auto Connect，同类型 Master→Slave）
- [x] 地址映射与冲突检测（Address Map，编辑 UI 待完善）
- [ ] 参数传播（Parameter Propagation）

### Phase 4: IP Packager 与自动化 (Week 8-9)
- [x] IP 封装向导（6 步：`PackageIPWizard`）
- [x] VLNV 命名体系
- [x] 基础设计验证（DRC：连接兼容性、地址冲突、缺失地址映射）
- [x] Tcl 脚本导出（`write_bd_tcl` 风格）
- [ ] 输出产物生成（HDL Wrapper, Simulation Model）

### Phase 5: 测试与优化 (Week 10-11)
- [ ] 前端单元测试（Jest/Vitest）覆盖率 ≥ 80%
- [ ] 集成测试（完整设计流程）
- [ ] 性能测试与优化
- [x] 用户文档与开发文档完善
- [x] 代码审查问题整改

## 风险管理

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| IP-XACT 标准复杂 | 高 | 先实现子集，逐步扩展 |
| 接口抽象设计难度 | 高 | 参考 Vivado IPI 的 AXI 接口模型 |
| 地址映射算法 | 中 | 参考 ARM 的地址分配规则 |
| 浏览器文件访问限制 | 中 | File System Access API + Blob 下载 fallback |
| 前端性能瓶颈（大量 Cell） | 中 | Canvas 分层渲染、按需重绘、未来可考虑 WebGL |
