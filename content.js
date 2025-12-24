// content.js - 内容脚本（核心采集逻辑）

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'capture') {
    capturePageData()
      .then(data => {
        sendResponse({ success: true, ...data });
      })
      .catch(error => {
        console.error('采集错误:', error);
        sendResponse({ 
          success: false, 
          error: error.message 
        });
      });
    
    // 返回 true 表示异步响应
    return true;
  }
});

// 主采集函数
async function capturePageData() {
  try {
    // 1. 提取基础元数据
    const metadata = extractMetadata();
    
    // 2. 生成 HTML 快照（插入 <base> 标签）
    const htmlSnapshot = generateHtmlSnapshot();
    
    // 3. 提取图表和图片
    const assets = await extractAssets();
    
    return {
      url: metadata.url,
      domain: metadata.domain,
      title: metadata.title,
      htmlSnapshot: htmlSnapshot,
      assets: assets
    };
  } catch (error) {
    throw new Error('采集数据时出错: ' + error.message);
  }
}

// 提取基础元数据
function extractMetadata() {
  return {
    url: window.location.href,
    title: document.title,
    domain: window.location.hostname
  };
}

// 生成 HTML 快照并插入 <base> 标签
function generateHtmlSnapshot() {
  // 获取完整的 HTML
  let html = document.documentElement.outerHTML;
  
  // 构建 base href（使用 origin + pathname，不包括 query 和 hash）
  const baseHref = window.location.protocol + "//" + window.location.host + window.location.pathname;
  
  // 检查是否已有 <base> 标签
  const baseTagRegex = /<base[^>]*>/i;
  const hasBaseTag = baseTagRegex.test(html);
  
  if (!hasBaseTag) {
    // 在 <head> 标签后插入 <base> 标签
    const headTagRegex = /<head[^>]*>/i;
    if (headTagRegex.test(html)) {
      html = html.replace(
        headTagRegex,
        (match) => match + `\n<base href="${baseHref}">`
      );
    } else {
      // 如果没有 <head> 标签，在 <html> 后添加
      const htmlTagRegex = /<html[^>]*>/i;
      if (htmlTagRegex.test(html)) {
        html = html.replace(
          htmlTagRegex,
          (match) => match + `\n<head><base href="${baseHref}"></head>`
        );
      }
    }
  }
  
  return html;
}

// 提取所有资源（Canvas 图表和图片）
async function extractAssets() {
  const assets = [];
  
  // 1. 处理所有 Canvas 元素
  const canvases = document.querySelectorAll('canvas');
  for (const canvas of canvases) {
    const canvasAsset = processCanvas(canvas);
    if (canvasAsset) {
      assets.push(canvasAsset);
    }
  }
  
  // 2. 处理所有符合条件的图片
  const images = document.querySelectorAll('img');
  for (const img of images) {
    const imageAsset = await processImage(img);
    if (imageAsset) {
      assets.push(imageAsset);
    }
  }
  
  return assets;
}

// 处理 Canvas 元素
function processCanvas(canvas) {
  try {
    // 检查 canvas 是否为空
    if (canvas.width === 0 || canvas.height === 0) {
      return null;
    }
    
    // 尝试转换为 base64
    const dataURL = canvas.toDataURL("image/png");
    
    // 检查是否成功（如果 canvas 被跨域污染，toDataURL 可能返回默认的空白图片）
    // 这里我们假设如果能够调用 toDataURL 就认为成功
    return {
      type: "canvas_chart",
      base64: dataURL,
      width: canvas.width,
      height: canvas.height
    };
  } catch (error) {
    // 处理跨域污染 (Tainted canvas)
    // SecurityError: The canvas has been tainted by cross-origin data
    console.warn("Canvas 跨域污染，跳过:", canvas, error);
    return null;
  }
}

// 处理图片元素
async function processImage(img) {
  try {
    // 检查图片是否已加载
    if (!img.complete) {
      // 等待图片加载
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        // 设置超时
        setTimeout(() => reject(new Error('图片加载超时')), 5000);
      });
    }
    
    const src = img.src || img.getAttribute('src') || '';
    
    // 过滤条件：
    // 1. base64 格式的图片
    // 2. 尺寸大于 300x300 的图片（过滤小图标）
    const isBase64 = src.startsWith('data:image/');
    const isLargeEnough = img.naturalWidth >= 300 && img.naturalHeight >= 300;
    
    if (!isBase64 && !isLargeEnough) {
      return null;
    }
    
    // 如果是 base64，直接提取
    if (isBase64) {
      return {
        type: "image",
        base64: src,
        width: img.naturalWidth,
        height: img.naturalHeight
      };
    }
    
    // 如果是 URL，尝试获取 base64
    try {
      const base64 = await imageUrlToBase64(src);
      return {
        type: "image",
        base64: base64,
        src_url: src,
        width: img.naturalWidth,
        height: img.naturalHeight
      };
    } catch (fetchError) {
      // 如果无法获取 base64（CORS 限制），至少保留 URL
      console.warn("无法获取图片 base64，保留 URL:", src, fetchError);
      return {
        type: "image",
        src_url: src,
        width: img.naturalWidth,
        height: img.naturalHeight
      };
    }
  } catch (error) {
    console.warn("处理图片时出错，跳过:", img, error);
    return null;
  }
}

// 将图片 URL 转换为 base64
async function imageUrlToBase64(url) {
  try {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    throw new Error('无法获取图片: ' + error.message);
  }
}

