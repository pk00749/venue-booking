// API 请求工具
// 开发环境使用本地后端，生产环境使用正式域名
const API_BASE = 'http://localhost:8000/api'

// 存储 token
function setToken(token) {
  wx.setStorageSync('token', token)
}

function getToken() {
  return wx.getStorageSync('token')
}

// 清除登录状态
function clearAuth() {
  wx.removeStorageSync('token')
  wx.removeStorageSync('user')
}

// 请求封装
function request(options) {
  const token = getToken()

  return new Promise((resolve, reject) => {
    wx.request({
      url: API_BASE + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else if (res.statusCode === 401) {
          // token 无效，清除并跳转登录
          clearAuth()
          wx.navigateTo({ url: '/pages/login/login' })
          reject(new Error('未登录'))
        } else {
          reject(new Error(res.data.detail || '请求失败'))
        }
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

// 微信登录（使用 code）
async function wxLoginWithCode(code) {
  return request({
    url: '/auth/wechat',
    method: 'POST',
    data: { code }
  })
}

// 微信登录（内部使用 wx.login + wxLoginWithCode）
async function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: async (res) => {
        if (!res.code) {
          return reject(new Error('获取授权码失败'))
        }
        try {
          const data = await wxLoginWithCode(res.code)
          setToken(data.token)
          resolve(data)
        } catch (err) {
          reject(err)
        }
      },
      fail: reject
    })
  })
}

// 获取当前用户
async function getMe() {
  return request({ url: '/auth/me' })
}

// 申请成为场主
async function applyOwner(reason) {
  return request({
    url: '/auth/apply-owner',
    method: 'POST',
    data: { reason }
  })
}

// 获取我的申请记录
async function getMyApplications() {
  return request({ url: '/auth/my-applications' })
}

// 更新用户信息
async function updateMe(data) {
  return request({
    url: '/auth/me',
    method: 'PUT',
    data
  })
}

// 申请成为场主
async function applyOwner() {
  return request({
    url: '/auth/apply-owner',
    method: 'POST'
  })
}

// 获取场地列表
async function getVenues(params = {}) {
  const query = Object.keys(params)
    .map(k => `${k}=${params[k]}`)
    .join('&')
  return request({ url: `/venues?${query}` })
}

// 获取场地详情
async function getVenue(id) {
  return request({ url: `/venues/${id}` })
}

// 获取场地时段
async function getVenueSlots(venueId, date) {
  return request({ url: `/venues/${venueId}/slots?date=${date}` })
}

// 创建预订
async function createBooking(data) {
  return request({
    url: '/bookings',
    method: 'POST',
    data
  })
}

// 获取我的预订
async function getMyBookings(status) {
  const query = status ? `?status=${status}` : ''
  return request({ url: `/bookings${query}` })
}

// 取消预订
async function cancelBooking(id, reason) {
  return request({
    url: `/bookings/${id}/cancel`,
    method: 'PUT',
    data: { reason }
  })
}

// 获取我的场地（场主）
async function getMyVenues() {
  return request({ url: '/venues/owner/my' })
}

// 创建场地（场主）
async function createVenue(data) {
  return request({
    url: '/venues',
    method: 'POST',
    data
  })
}

// 更新场地（场主）
async function updateVenue(id, data) {
  return request({
    url: `/venues/${id}`,
    method: 'PUT',
    data
  })
}

// 更新场地状态（场主）
async function updateVenueStatus(id, status) {
  return request({
    url: `/venues/${id}/status`,
    method: 'PUT',
    data: { status }
  })
}

// 删除场地（场主）
async function deleteVenue(id) {
  return request({
    url: `/venues/${id}`,
    method: 'DELETE'
  })
}

// 上传场地图片（使用微信 wx.uploadFile）
function uploadVenueImage(filePath) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: API_BASE + '/upload/image',
      filePath: filePath,
      name: 'image',
      header: {
        'Authorization': getToken() ? `Bearer ${getToken()}` : ''
      },
      success: (res) => {
        if (res.statusCode === 200) {
          const data = JSON.parse(res.data)
          resolve(data.url)
        } else {
          reject(new Error('上传失败'))
        }
      },
      fail: reject
    })
  })
}

// 获取待审核预订（场主）
async function getPendingBookings() {
  return request({ url: '/bookings/owner/pending' })
}

// 批准预订（场主）
async function approveBooking(id) {
  return request({
    url: `/bookings/owner/${id}/approve`,
    method: 'PUT'
  })
}

// 拒绝预订（场主）
async function rejectBooking(id, reason) {
  return request({
    url: `/bookings/owner/${id}/reject`,
    method: 'PUT',
    data: { reason }
  })
}

module.exports = {
  setToken,
  getToken,
  clearAuth,
  request,
  wxLoginWithCode,
  wxLogin,
  getMe,
  updateMe,
  applyOwner,
  getVenues,
  getVenue,
  getVenueSlots,
  createBooking,
  getMyBookings,
  cancelBooking,
  getMyVenues,
  getPendingBookings,
  approveBooking,
  rejectBooking,
  createVenue,
  updateVenue,
  updateVenueStatus,
  deleteVenue,
  uploadVenueImage
}
