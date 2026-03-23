// pages/login/login.js
const api = require('../../utils/api.js')

Page({
  data: {
    loading: false
  },

  onLoad() {
    // 检查是否已登录
    const token = api.getToken()
    if (token) {
      this.checkLogin(token)
    }
  },

  async checkLogin(token) {
    try {
      const user = await api.getMe()
      // 已登录，跳转到首页
      wx.switchTab({ url: '/pages/index/index' })
    } catch (e) {
      // token 无效，清除并停留在登录页
      api.setToken('')
    }
  },

  async handleWechatLogin() {
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      // 1. 调用 wx.login 获取 code
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        })
      })

      if (!loginRes.code) {
        throw new Error('获取授权码失败')
      }

      // 2. 发送 code 到后端换取 token
      const res = await api.wxLoginWithCode(loginRes.code)

      // 3. 存储 token
      api.setToken(res.token)

      // 4. 存储用户信息
      wx.setStorageSync('user', res.user)

      // 5. 提示并跳转
      if (res.is_new_user) {
        wx.showToast({
          title: '欢迎使用！',
          icon: 'success'
        })
      } else {
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        })
      }

      // 6. 跳转首页
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' })
      }, 1500)

    } catch (err) {
      console.error('登录失败:', err)
      wx.showModal({
        title: '登录失败',
        content: err.message || '请检查网络后重试',
        showCancel: false
      })
    } finally {
      this.setData({ loading: false })
    }
  }
})
