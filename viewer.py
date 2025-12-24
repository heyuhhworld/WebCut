#!/usr/bin/env python3
"""
采集数据查看工具
用于浏览和查看已采集的网页数据
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List

DATA_DIR = "collected_data"


def list_all_files() -> List[str]:
    """列出所有采集的数据文件"""
    if not os.path.exists(DATA_DIR):
        print(f"❌ 数据目录不存在: {DATA_DIR}")
        return []
    
    files = sorted([f for f in os.listdir(DATA_DIR) if f.endswith('.json')], reverse=True)
    return files


def load_file(filename: str) -> Dict:
    """加载 JSON 文件"""
    filepath = os.path.join(DATA_DIR, filename)
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ 读取文件失败: {e}")
        return None


def format_size(size_bytes: int) -> str:
    """格式化文件大小"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"


def show_summary(data: Dict, filename: str) -> None:
    """显示数据摘要"""
    print("\n" + "=" * 60)
    print("📄 文件信息")
    print("=" * 60)
    print(f"文件名: {filename}")
    
    filepath = os.path.join(DATA_DIR, filename)
    file_size = os.path.getsize(filepath)
    print(f"文件大小: {format_size(file_size)}")
    
    print("\n" + "-" * 60)
    print("📋 元数据")
    print("-" * 60)
    print(f"用户ID: {data.get('user_id', 'N/A')}")
    print(f"域名: {data.get('domain', 'N/A')}")
    print(f"标题: {data.get('title', 'N/A')}")
    print(f"URL: {data.get('source_url', 'N/A')}")
    print(f"采集时间: {data.get('captured_at', 'N/A')}")
    
    print("\n" + "-" * 60)
    print("📊 资源统计")
    print("-" * 60)
    assets = data.get('assets', [])
    print(f"总资源数: {len(assets)}")
    
    canvas_count = sum(1 for a in assets if a.get('type') == 'canvas_chart')
    image_count = sum(1 for a in assets if a.get('type') == 'image')
    
    print(f"  - Canvas 图表: {canvas_count}")
    print(f"  - 图片: {image_count}")
    
    html_snapshot = data.get('html_snapshot', '')
    print(f"\nHTML 快照大小: {format_size(len(html_snapshot))}")
    
    # 显示资源详情（前10个）
    if assets:
        print("\n" + "-" * 60)
        print("🖼️  资源列表（前10个）")
        print("-" * 60)
        for i, asset in enumerate(assets[:10], 1):
            asset_type = asset.get('type', 'unknown')
            width = asset.get('width', '?')
            height = asset.get('height', '?')
            has_base64 = 'base64' in asset and asset.get('base64')
            has_url = 'src_url' in asset and asset.get('src_url')
            
            print(f"{i}. [{asset_type}] {width}x{height}", end="")
            if has_base64:
                base64_size = len(asset.get('base64', ''))
                print(f" | Base64: {format_size(base64_size)}", end="")
            if has_url:
                print(f" | URL: {asset.get('src_url', '')[:50]}...", end="")
            print()
        
        if len(assets) > 10:
            print(f"\n... 还有 {len(assets) - 10} 个资源未显示")


def show_assets(data: Dict) -> None:
    """显示所有资源详情"""
    assets = data.get('assets', [])
    if not assets:
        print("\n⚠️  没有采集到任何资源")
        return
    
    print("\n" + "=" * 60)
    print(f"🖼️  所有资源 ({len(assets)} 个)")
    print("=" * 60)
    
    for i, asset in enumerate(assets, 1):
        print(f"\n[{i}/{len(assets)}] {asset.get('type', 'unknown').upper()}")
        print("-" * 60)
        
        if asset.get('width') and asset.get('height'):
            print(f"尺寸: {asset.get('width')} x {asset.get('height')}")
        
        if asset.get('base64'):
            base64_data = asset.get('base64', '')
            size = len(base64_data)
            print(f"Base64 数据: {format_size(size)}")
            if base64_data.startswith('data:image'):
                print(f"格式: {base64_data.split(';')[0].split(':')[1]}")
        
        if asset.get('src_url'):
            print(f"源URL: {asset.get('src_url')}")


def show_html_preview(data: Dict, lines: int = 50) -> None:
    """显示 HTML 快照预览"""
    html = data.get('html_snapshot', '')
    if not html:
        print("\n⚠️  没有 HTML 快照")
        return
    
    print("\n" + "=" * 60)
    print("📄 HTML 快照预览（前50行）")
    print("=" * 60)
    
    html_lines = html.split('\n')
    for i, line in enumerate(html_lines[:lines], 1):
        print(f"{i:4d} | {line[:100]}{'...' if len(line) > 100 else ''}")
    
    if len(html_lines) > lines:
        print(f"\n... 还有 {len(html_lines) - lines} 行未显示")


def save_html(data: Dict, filename: str) -> None:
    """保存 HTML 快照到独立文件"""
    html = data.get('html_snapshot', '')
    if not html:
        print("\n⚠️  没有 HTML 快照可保存")
        return
    
    html_filename = filename.replace('.json', '.html')
    html_filepath = os.path.join(DATA_DIR, html_filename)
    
    try:
        with open(html_filepath, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"\n✅ HTML 快照已保存到: {html_filepath}")
    except Exception as e:
        print(f"\n❌ 保存 HTML 失败: {e}")


def main():
    """主函数"""
    print("\n" + "=" * 60)
    print("🔍 采集数据查看工具")
    print("=" * 60)
    
    # 列出所有文件
    files = list_all_files()
    
    if not files:
        print(f"\n⚠️  在 {DATA_DIR} 目录中没有找到任何数据文件")
        return
    
    print(f"\n📁 找到 {len(files)} 个数据文件:\n")
    for i, filename in enumerate(files, 1):
        filepath = os.path.join(DATA_DIR, filename)
        file_size = os.path.getsize(filepath)
        print(f"  {i}. {filename} ({format_size(file_size)})")
    
    # 如果只有一个文件，直接显示
    if len(files) == 1:
        filename = files[0]
        print(f"\n自动加载: {filename}")
    else:
        # 让用户选择文件
        try:
            choice = input(f"\n请选择要查看的文件 (1-{len(files)})，或按 Enter 查看最新文件: ").strip()
            if choice == "":
                filename = files[0]
            else:
                idx = int(choice) - 1
                if 0 <= idx < len(files):
                    filename = files[idx]
                else:
                    print("❌ 无效的选择")
                    return
        except (ValueError, KeyboardInterrupt):
            print("\n❌ 操作已取消")
            return
    
    # 加载文件
    print(f"\n正在加载: {filename}...")
    data = load_file(filename)
    
    if not data:
        return
    
    # 显示摘要
    show_summary(data, filename)
    
    # 交互式菜单
    while True:
        print("\n" + "=" * 60)
        print("📋 操作菜单")
        print("=" * 60)
        print("1. 查看所有资源详情")
        print("2. 预览 HTML 快照")
        print("3. 保存 HTML 到文件")
        print("4. 返回文件列表")
        print("0. 退出")
        
        try:
            choice = input("\n请选择操作: ").strip()
            
            if choice == "1":
                show_assets(data)
            elif choice == "2":
                show_html_preview(data)
            elif choice == "3":
                save_html(data, filename)
            elif choice == "4":
                main()  # 重新开始
                return
            elif choice == "0":
                print("\n👋 再见！")
                return
            else:
                print("❌ 无效的选择，请重试")
        except KeyboardInterrupt:
            print("\n\n👋 再见！")
            return


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 再见！")
        sys.exit(0)

