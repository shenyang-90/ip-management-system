# 信号级连接 UI 设计文档

## 目标

补齐 Block Design 中信号级（net-level）连接的完整 UI 工作流。当前数据模型已支持 `BDConnection.connection_type: 'signal'`，但 Canvas 只渲染接口级连接，用户无法创建信号连接。

## 当前问题

- `BDConnection` 支持 `source_signal` / `target_signal`
- `ConnectionService` 提供 `connectSignals()` 但未实现
- Canvas 只绘制接口端口，不展示接口内部的信号
- 没有创建信号级连接的入口

## 改进方案

### 1. 数据模型补充

确保 `connectSignals()` 在 `ConnectionService` 中完整实现：

```javascript
connectSignals(sourceCellId, sourceSignal, targetCellId, targetSignal) {
    const conn = new BDConnection({
        source_cell_id: sourceCellId,
        source_signal: sourceSignal,
        target_cell_id: targetCellId,
        target_signal: targetSignal,
        connection_type: 'signal'
    });
    design.connections.push(conn);
    return conn;
}
```

### 2. 信号连接创建 UI

采用**最小侵入**方案，不在 Canvas 上为每个信号添加小端口，而是使用模态框选择信号：

#### 方案：Signal Connection Dialog

1. 用户点击工具栏 **Signal Connect** 按钮或右键菜单
2. 弹出模态框：
   - 左侧：Source Cell + Source Signal（下拉框，列出所选 Cell 接口中的所有信号）
   - 右侧：Target Cell + Target Signal
3. 点击 Connect 创建信号级连接

### 3. 信号列表来源

从 IP Entity 的接口定义中提取信号：

```javascript
function getSignalsForCell(cell) {
    const ip = ipCatalogService.getById(cell.ip_entity_id);
    const signals = [];
    for (const iface of ip.interfaces) {
        for (const sig of iface.signals || []) {
            signals.push({
                cellInterface: iface.name,
                signalName: sig.name,
                direction: sig.direction,
                label: `${iface.name}/${sig.name}`
            });
        }
    }
    return signals;
}
```

### 4. Canvas 渲染

信号级连接用**虚线**或**不同颜色**的贝塞尔曲线表示，与接口级连接的实线区分：

- 接口连接：实线 + 箭头
- 信号连接：虚线 + 无箭头

`CanvasRenderer.drawConnections()` 根据 `connection_type` 选择线型。

### 5. 选择与高亮

- 信号连接线可被点击选中
- 按 Delete 删除
- 属性面板显示信号连接详情

## 测试策略

- 单元测试：
  - `connectSignals` 创建正确数据结构
  - 信号列表提取
- 浏览器 E2E：
  - 打开 Signal Connection 模态框
  - 选择 source/target 信号
  - 创建连接并验证画布上显示虚线
  - 选中并删除连接
