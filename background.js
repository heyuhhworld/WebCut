// background.js - 后台服务 Worker
// 用于处理 CORS 问题和后台任务

// 监听扩展安装
chrome.runtime.onInstalled.addListener(() => {
  console.log('金融数据采集插件已安装');
});

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendToApi') {
    // 在 service worker 中发送请求，不受 CORS 限制
    sendToApi(request.endpoint, request.payload)
      .then(response => {
        sendResponse({ success: true, response });
      })
      .catch(error => {
        console.error('API 请求失败:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // 返回 true 表示异步响应
    return true;
  }
  
  if (request.action === 'checkApiStatus') {
    // 检查 API 连接状态
    checkApiStatus(request.endpoint)
      .then(status => {
        sendResponse({ success: true, status });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
});

// 发送数据到 API
async function sendToApi(endpoint, payload) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorData = await response.text().catch(() => '无法读取错误信息');
      throw new Error(`API 返回错误 (${response.status}): ${errorData.substring(0, 100)}`);
    }
    
    const responseData = await response.json().catch(() => ({}));
    return responseData;
  } catch (error) {
    // 处理网络错误
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('无法连接到 API，请检查：\n1. 后端服务是否运行\n2. API Endpoint 是否正确\n3. 网络连接是否正常');
    }
    throw error;
  }
}

// 检查 API 连接状态
async function checkApiStatus(endpoint) {
  try {
    const response = await fetch(endpoint, {
      method: 'OPTIONS',
      mode: 'cors'
    }).catch(() => null);
    
    if (response && (response.ok || response.status === 405)) {
      return 'connected';
    } else {
      return 'unknown';
    }
  } catch (error) {
    return 'failed';
  }
}

