// popup.js - 弹窗逻辑处理

// DOM 元素引用
const apiEndpointInput = document.getElementById('apiEndpoint');
const userIdInput = document.getElementById('userId');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const captureBtn = document.getElementById('captureBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const currentEndpoint = document.getElementById('currentEndpoint');
const currentUserId = document.getElementById('currentUserId');
const progressText = document.getElementById('progressText');
const errorText = document.getElementById('errorText');
const successText = document.getElementById('successText');

// 默认配置
const DEFAULT_API_ENDPOINT = 'http://localhost:8000/api/ingest/extension';

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await checkApiStatus();
});

// 从 storage 加载配置
async function loadConfig() {
  try {
    const result = await chrome.storage.local.get(['apiEndpoint', 'userId']);
    
    if (result.apiEndpoint) {
      apiEndpointInput.value = result.apiEndpoint;
      currentEndpoint.textContent = result.apiEndpoint;
    } else {
      apiEndpointInput.value = DEFAULT_API_ENDPOINT;
      currentEndpoint.textContent = DEFAULT_API_ENDPOINT;
    }
    
    if (result.userId) {
      userIdInput.value = result.userId;
      currentUserId.textContent = result.userId;
    } else {
      currentUserId.textContent = '-';
    }
  } catch (error) {
    console.error('加载配置失败:', error);
    showError('加载配置失败: ' + error.message);
  }
}

// 保存配置
saveConfigBtn.addEventListener('click', async () => {
  const apiEndpoint = apiEndpointInput.value.trim();
  const userId = userIdInput.value.trim();
  
  // 验证输入
  if (!apiEndpoint) {
    showError('请输入 API Endpoint');
    return;
  }
  
  if (!userId) {
    showError('请输入 User ID');
    return;
  }
  
  // 验证 URL 格式
  try {
    new URL(apiEndpoint);
  } catch (e) {
    showError('API Endpoint 格式不正确');
    return;
  }
  
  try {
    // 保存到 storage
    await chrome.storage.local.set({
      apiEndpoint: apiEndpoint,
      userId: userId
    });
    
    // 更新显示
    currentEndpoint.textContent = apiEndpoint;
    currentUserId.textContent = userId;
    
    // 显示成功提示
    showSuccess('配置已保存');
    
    // 检查 API 状态
    await checkApiStatus();
  } catch (error) {
    console.error('保存配置失败:', error);
    showError('保存配置失败: ' + error.message);
  }
});

// 检查 API 连接状态
async function checkApiStatus() {
  try {
    const result = await chrome.storage.local.get(['apiEndpoint']);
    const endpoint = result.apiEndpoint || DEFAULT_API_ENDPOINT;
    
    // 通过 background service worker 检查连接状态
    const response = await chrome.runtime.sendMessage({
      action: 'checkApiStatus',
      endpoint: endpoint
    });
    
    if (!response || !response.success) {
      statusIndicator.className = 'status-indicator warning';
      statusText.textContent = '连接未知（请检查后端服务是否运行）';
      return;
    }
    
    // 更新状态指示器
    if (response.status === 'connected') {
      statusIndicator.className = 'status-indicator connected';
      statusText.textContent = '已连接';
    } else if (response.status === 'unknown') {
      statusIndicator.className = 'status-indicator warning';
      statusText.textContent = '连接未知（请检查后端服务是否运行）';
    } else {
      statusIndicator.className = 'status-indicator error';
      statusText.textContent = '连接失败';
    }
  } catch (error) {
    statusIndicator.className = 'status-indicator error';
    statusText.textContent = '连接失败: ' + error.message;
  }
}

// 采集并保存按钮点击事件
captureBtn.addEventListener('click', async () => {
  // 清除之前的反馈
  clearFeedback();
  
  // 验证配置
  const result = await chrome.storage.local.get(['apiEndpoint', 'userId']);
  const apiEndpoint = result.apiEndpoint || DEFAULT_API_ENDPOINT;
  const userId = result.userId;
  
  if (!userId) {
    showError('请先配置 User ID');
    return;
  }
  
  try {
    // 显示进度
    showProgress('正在处理 DOM...');
    
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      showError('无法获取当前标签页');
      return;
    }
    
    // 确保 content script 已注入
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (e) {
      // content script 可能已经注入，忽略错误
      console.log('Content script 可能已存在:', e);
    }
    
    // 发送消息给 content script 触发采集
    showProgress('正在提取图表...');
    
    let captureResult;
    try {
      captureResult = await chrome.tabs.sendMessage(tab.id, {
        action: 'capture'
      });
    } catch (messageError) {
      // 处理消息发送失败（例如 content script 未正确注入）
      throw new Error('无法与页面通信，请刷新页面后重试');
    }
    
    if (!captureResult) {
      throw new Error('未收到采集结果');
    }
    
    if (!captureResult.success || captureResult.error) {
      throw new Error(captureResult.error || '采集失败');
    }
    
    // 组装 JSON payload
    showProgress('正在上传数据...');
    
    const payload = {
      user_id: userId,
      source_url: captureResult.url,
      domain: captureResult.domain,
      title: captureResult.title,
      html_snapshot: captureResult.htmlSnapshot,
      captured_at: new Date().toISOString(),
      assets: captureResult.assets || []
    };
    
    // 通过 background service worker 发送到 API（避免 CORS 限制）
    try {
      const apiResponse = await chrome.runtime.sendMessage({
        action: 'sendToApi',
        endpoint: apiEndpoint,
        payload: payload
      });
      
      if (!apiResponse || !apiResponse.success) {
        throw new Error(apiResponse?.error || '上传失败');
      }
      
      // 显示成功
      showSuccess(`上传成功！已采集 ${captureResult.assets?.length || 0} 个资源`);
    } catch (messageError) {
      // 处理消息发送失败
      throw new Error('无法发送数据到后台服务: ' + messageError.message);
    }
    
  } catch (error) {
    console.error('采集失败:', error);
    showError('采集失败: ' + error.message);
  }
});

// 显示进度信息
function showProgress(message) {
  progressText.textContent = message;
  progressText.classList.remove('hidden');
  errorText.classList.add('hidden');
  successText.classList.add('hidden');
}

// 显示错误信息
function showError(message) {
  errorText.textContent = message;
  errorText.classList.remove('hidden');
  successText.classList.add('hidden');
  progressText.classList.add('hidden');
}

// 显示成功信息
function showSuccess(message) {
  successText.textContent = message;
  successText.classList.remove('hidden');
  errorText.classList.add('hidden');
  progressText.classList.add('hidden');
}

// 清除反馈
function clearFeedback() {
  progressText.textContent = '';
  errorText.textContent = '';
  successText.textContent = '';
  progressText.classList.add('hidden');
  errorText.classList.add('hidden');
  successText.classList.add('hidden');
}

