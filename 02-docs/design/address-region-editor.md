# 地址分配编辑器 UI 设计文档

## 目标

在属性面板中为 AXI4-Lite Slave 等需要地址映射的接口提供可视化的地址分配编辑能力。

## 当前问题

- `address_regions` 只能在 `designs/*.json` 中手动编辑
- 用户无法从 UI 为 Slave 接口分配 `base_address` / `high_address`
- 缺少地址冲突的可视化反馈

## 改进方案

### 1. 在 PropertiesPanel 中新增 Address Regions 编辑区

当选中 Cell 且该 Cell 包含 Slave 接口时，右侧面板显示：

- **Current Address Regions** 列表
  - 每个区域显示：接口名、base、high、size
  - 编辑按钮、删除按钮
- **Add Address Region** 表单
  - 接口选择下拉框（仅显示当前 Cell 的 slave 接口）
  - Base Address 输入（支持十六进制如 `0x40000000`）
  - Size 输入（字节数）
  - High Address 自动计算并显示
  - 添加按钮

### 2. 地址区域自动计算

```javascript
function computeAddressRegion(baseAddress, size) {
    const base = parseAddress(baseAddress);
    const high = base + size - 1;
    return { base, high, size };
}
```

### 3. 与 `BlockDesignService` 集成

新增方法：

- `addAddressRegion(cellId, interfaceName, baseAddress, size)`
- `updateAddressRegion(regionId, baseAddress, size)`
- `removeAddressRegion(regionId)`
- `getAddressRegionsForCell(cellId)`

这些方法会：
- 调用 `validateAddressRegions()` 检查冲突
- 更新/创建 `AddressRegion`
- 同步更新 Cell 的 `register_address_map`（根据 IP 的寄存器偏移计算绝对地址）

### 4. 寄存器绝对地址同步

当为 Slave 接口分配基地址后，自动将该 IP 定义中的寄存器相对偏移转换为绝对地址：

```javascript
for (const reg of ipEntity.register_map.registers) {
    const offset = parseInt(reg.offset, 16);
    cell.register_address_map[reg.name] = baseAddress + offset;
}
```

这些绝对地址也会写入 `address_regions[].register_map`。

### 5. 地址冲突检测

- 添加/更新地址区域时立即调用 `validateAddressRegions()`
- 若冲突，提示用户并阻止保存
- 在验证报告面板中显示冲突项

## 测试策略

- 单元测试：
  - `computeAddressRegion` 计算
  - 地址冲突检测
  - 寄存器绝对地址同步
- 浏览器 E2E：
  - 选中 AXI GPIO Cell
  - 为 `S_AXI` 接口添加地址区域 `0x40000000` / size 512
  - 验证 `address_regions` 和 `register_address_map` 正确更新
  - 尝试添加重叠区域，验证被拒绝
