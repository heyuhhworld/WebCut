#!/usr/bin/env python3
"""
金融数据采集后端 API 服务
接收 Chrome Extension 发送的网页数据
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import json
import os

app = FastAPI(title="金融数据采集 API", version="1.0.0")

# 配置 CORS - 允许 Chrome Extension 访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发环境允许所有来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 数据存储目录
DATA_DIR = "collected_data"
os.makedirs(DATA_DIR, exist_ok=True)


# 数据模型定义
class Asset(BaseModel):
    type: str  # "canvas_chart" 或 "image"
    base64: Optional[str] = None
    src_url: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None


class IngestRequest(BaseModel):
    user_id: str
    source_url: str
    domain: str
    title: str
    html_snapshot: str
    captured_at: str
    assets: List[Asset] = []


@app.get("/")
async def root():
    """根路径，返回 API 信息"""
    return {
        "message": "金融数据采集 API",
        "version": "1.0.0",
        "endpoints": {
            "ingest": "/api/ingest/extension"
        }
    }


@app.get("/api/health")
async def health_check():
    """健康检查端点"""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.post("/api/ingest/extension")
async def ingest_extension_data(data: IngestRequest):
    """
    接收 Chrome Extension 发送的网页数据
    
    Args:
        data: 包含网页快照、元数据和资源的请求体
    
    Returns:
        成功响应，包含保存的文件路径
    """
    try:
        # 生成文件名（使用时间戳和域名）
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_domain = data.domain.replace(".", "_")
        filename = f"{timestamp}_{safe_domain}_{data.user_id}.json"
        filepath = os.path.join(DATA_DIR, filename)
        
        # 将数据转换为字典
        data_dict = data.dict()
        
        # 保存到文件
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data_dict, f, ensure_ascii=False, indent=2)
        
        # 统计信息
        assets_count = len(data.assets)
        canvas_count = sum(1 for asset in data.assets if asset.type == "canvas_chart")
        image_count = sum(1 for asset in data.assets if asset.type == "image")
        
        return {
            "success": True,
            "message": "数据已成功保存",
            "filepath": filepath,
            "stats": {
                "total_assets": assets_count,
                "canvas_charts": canvas_count,
                "images": image_count,
                "html_size": len(data.html_snapshot)
            },
            "metadata": {
                "user_id": data.user_id,
                "domain": data.domain,
                "title": data.title,
                "source_url": data.source_url,
                "captured_at": data.captured_at
            }
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"保存数据时出错: {str(e)}"
        )


@app.options("/api/ingest/extension")
async def options_ingest():
    """处理 OPTIONS 预检请求"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    
    print("=" * 50)
    print("金融数据采集后端服务")
    print("=" * 50)
    print(f"API 文档: http://localhost:8000/docs")
    print(f"健康检查: http://localhost:8000/api/health")
    print(f"数据保存目录: {os.path.abspath(DATA_DIR)}")
    print("=" * 50)
    
    uvicorn.run(app, host="0.0.0.0", port=8000)

