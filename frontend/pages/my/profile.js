// pages/my/profile.js
const api = require('../../utils/api.js')

Page({
  data: {
    user: null,
    hasOwnerRole: false,
    isAdmin: false,
    applying: false
  },

  onShow() {
    const user = wx.getStorageSync('user')
    if (user) {
      // 确保 roles 字段存在
      const roles = user.roles || (user.role ? [user.role] : ['user'])
      const hasOwnerRole = roles.includes('owner') || roles.includes('admin')
      const isAdmin = roles.includes('admin')
      this.setData({
        user,
        hasOwnerRole,
        isAdmin
      })
    } else {
      this.setData({ user: null, hasOwnerRole: false, isAdmin: false })
    }
  },

  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          api.clearAuth()
          wx.removeStorageSync('user')
          wx.navigateTo({ url: '/pages/login/login' })
        }
      }
    })
  },

  goOwnerVenues() {
    wx.navigateTo({ url: '/pages/owner/venues' })
  },

  goOwnerBookings() {
    wx.navigateTo({ url: '/pages/owner/bookings' })
  },

  goAdminUsers() {
    wx.navigateTo({ url: '/pages/admin/users' })
  },

  async handleApplyOwner() {
    if (this.data.applying) return
    
    wx.showModal({
      title: '申请成为场主',
      content: '确定要申请成为场主吗？申请通过后您可以管理场地和审核预订。',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ applying: true })
          try {
            const result = await api.applyOwner()
            if (result.status === 'approved' || result.status === 'already_owner') {
              wx.showToast({
                title: result.message,
                icon: 'success'
              })
              // 刷新用户信息
              const user = await api.getMe()
              wx.setStorageSync('user', user)
              this.setData({ user })
              const roles = user.roles || (user.role ? [user.role] : ['user'])
              this.setData({
                hasOwnerRole: roles.includes('owner') || roles.includes('admin'),
                isAdmin: roles.includes('admin')
              })
            } else if (result.status === 'pending') {
              wx.showToast({
                title: '您已有待处理的申请',
                icon: 'none'
              })
            }
          } catch (err) {
            wx.showToast({
              title: err.message || '申请失败',
              icon: 'none'
            })
          } finally {
            this.setData({ applying: false })
          }
        }
      }
    })
  }
})
