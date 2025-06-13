# OHN单文件存储格式升级

## 修改概述

已将OHN（Original-Hour News）存储格式从多文件分类存储改为单文件分类存储，以JSON中的key来表示分类。

## 存储格式变更

### 之前的多文件格式
```
data/ohn/YYYYMMDD/
├── HH_macro_policy.json      # 宏观政策/系统风险
├── HH_market_shock.json      # 跨市场价格冲击
├── HH_industry_theme.json    # 行业/主题驱动
├── HH_major_entity.json      # 大型主体事件
├── HH_general_company.json   # 一般公司/区域性新闻
└── HH_summary.json           # 小时汇总信息
```

### 现在的单文件格式
```
data/ohn/YYYYMMDD/
└── HH.json                   # 包含所有分类的新闻数据
```

## 数据结构

### 单文件内容格式
```json
{
  "hour": "13",
  "timestamp": "2025-06-13T05:00:00.000Z",
  "totalCount": 21,
  "categories": {
    "宏观政策/系统风险": [
      {
        "id": "18958566",
        "mergedIds": ["合并的其他新闻ID"],
        "title": "以色列袭击伊朗事件",
        "content": "以军200架飞机投330弹药杀伊朗高官...",
        "time": "13:20",
        "level": "未知",
        "source": "未知",
        "detailUrl": ""
      }
    ],
    "跨市场价格冲击": [...],
    "行业/主题驱动": [...],
    "大型主体事件": [...],
    "一般公司/区域性新闻": [...]
  }
}
```

## 优势

1. **简化存储**：每小时只生成一个文件，便于管理
2. **数据完整性**：所有分类数据在同一文件中，避免分散
3. **查询效率**：单次文件读取获取所有分类数据
4. **兼容性好**：现有的查询接口保持不变

## 技术实现

### 主要修改文件
- `src/services/ohnService.js`：修改存储和读取逻辑
- `test/aiOhnProcessing.test.js`：移除已删除方法的测试
- `docs/`：更新相关文档

### 关键方法变更
- `saveOHNByCategory()`：改为保存到单个JSON文件
- `getOHNByTimeRange()`：适应新的文件格式读取
- `getOHNByCategoryRange()`：从单文件中提取分类数据
- 删除 `getCategoryFileName()`：不再需要文件名映射

## 测试验证

```bash
# 测试AI OHN处理
npm run trigger:ohn

# 测试HNS生成（验证读取兼容性）
npm run trigger:hns

# 系统健康检查
npm run health-check

# 草蛇灰线系统测试
npm run snake:hunt
npm run snake:status
```

## 实际效果

```
原始数据：50条新闻
AI处理后：21条新闻（压缩率58%）

存储文件：
└── data/ohn/20250613/13.json (7.3KB)

分类分布：
├── 宏观政策/系统风险: 6条
├── 跨市场价格冲击: 5条
├── 行业/主题驱动: 2条
├── 大型主体事件: 3条
└── 一般公司/区域性新闻: 5条
```

## 兼容性保证

- ✅ 所有现有API接口保持不变
- ✅ HNS、夜间汇总功能正常工作
- ✅ 查询性能无影响
- ✅ 数据完整性得到保证
- ✅ 草蛇灰线系统正常运行

升级完成后，系统通过了所有健康检查，各项功能运行正常。 