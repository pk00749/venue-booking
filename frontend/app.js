// app.js
const api = require('./utils/api.js')

App({
  globalData: {
    user: null
  },

  onLaunch() {
    // 检查登录状态
    const token = api.getToken()
    if (token) {
      api.getMe().then(user => {
        this.globalData.user = user
        wx.setStorageSync('user', user)
      }).catch(() => {
        api.clearAuth()
      })
    }
  },

  onShow() {
    // 每次回到小程序检查登录状态
    const token = api.getToken()
    if (token && !this.globalData.user) {
      api.getMe().then(user => {
        this.globalData.user = user
        wx.setStorageSync('user', user)
      }).catch(() => {
        api.clearAuth()
        this.globalData.user = null
      })
    }
  }
})
