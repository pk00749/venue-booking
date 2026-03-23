// pages/my/bookings.js
const api = require('../../utils/api.js')

Page({
  data: {
    bookings: [],
    loading: true,
    status: ''
  },

  statusMap: {
    pending: '待审核',
    confirmed: '已确认',
    cancelled: '已取消',
    completed: '已完成'
  },

  onLoad() {
    this.setData({ status: '' })
  },

  onShow() {
    this.loadBookings()
  },

  async loadBookings() {
    this.setData({ loading: true })
    try {
      const bookings = await api.getMyBookings()
      this.setData({ bookings, loading: false })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  goIndex() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  async handleCancel(e) {
    const id = e.currentTarget.dataset.id
    const reason = e.currentTarget.dataset.reason || ''
    
    wx.showModal({
      title: '确认取消',
      content: '确定要取消此预订吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.cancelBooking(id, reason)
            wx.showToast({ title: '已取消', icon: 'success' })
            this.loadBookings()
          } catch (err) {
            wx.showToast({ title: err.message || '取消失败', icon: 'none' })
          }
        }
      }
    })
  }
})
