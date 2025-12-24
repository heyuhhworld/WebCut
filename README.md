# WebCut - 金融数据采集 Chrome Extension

## 项目结构

```
webCut/
├── manifest.json          # Extension 配置文件
├── popup.html            # 弹窗 UI
├── popup.js              # 弹窗逻辑
├── content.js            # 内容脚本（采集逻辑）
├── background.js         # 后台服务 Worker
├── server.py             # 后端 API 服务
├── requirements.txt     # Python 依赖
├── viewer.py            # 数据查看工具
└── collected_data/       # 采集的数据存储目录（自动创建）
```

## 后端服务启动

### 1. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

### 2. 启动后端服务

```bash
python server.py
```

或者使用 uvicorn 直接启动：

```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后：
- API 地址: `http://localhost:8000`
- API 文档: `http://localhost:8000/docs` (Swagger UI)
- 健康检查: `http://localhost:8000/api/health`
- 数据接收端点: `http://localhost:8000/api/ingest/extension`

### 3. 验证服务运行

访问 `http://localhost:8000/api/health` 应该返回：
```json
{"status": "ok", "timestamp": "..."}
```

## Chrome Extension 安装

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目目录（包含 manifest.json 的目录）

## 使用说明

1. **配置插件**：
   - 点击扩展图标
   - 输入 API Endpoint（默认：`http://localhost:8000/api/ingest/extension`）
   - 输入 User ID
   - 点击"保存配置"

2. **采集数据**：
   - 访问目标网页（如 PitchBook、Preqin）
   - 点击扩展图标
   - 点击"采集并保存"按钮
   - 等待处理完成

3. **查看数据**：
   - 采集的数据保存在 `collected_data/` 目录
   - 文件名格式：`YYYYMMDD_HHMMSS_domain_userid.json`
   - 使用查看工具：`python3 viewer.py`

## 数据查看工具

使用内置的查看工具浏览采集的数据：

```bash
python3 viewer.py
```

功能包括：
- 列出所有采集的文件
- 显示数据摘要（元数据、资源统计）
- 查看所有资源详情
- 预览 HTML 快照
- 保存 HTML 到独立文件

## API 数据格式

接收的 JSON 格式：
```json
{
  "user_id": "user_123",
  "source_url": "https://example.com/page",
  "domain": "example.com",
  "title": "Page Title",
  "html_snapshot": "<html>...</html>",
  "captured_at": "2024-01-01T12:00:00Z",
  "assets": [
    {
      "type": "canvas_chart",
      "base64": "data:image/png;base64,...",
      "width": 800,
      "height": 400
    }
  ]
}
```
