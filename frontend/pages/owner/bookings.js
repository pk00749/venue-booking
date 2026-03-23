// pages/owner/bookings.js
const api = require('../../utils/api.js')

Page({
  data: {
    bookings: [],
    loading: true
  },

  onShow() {
    this.loadBookings()
  },

  async loadBookings() {
    this.setData({ loading: true })
    try {
      const bookings = await api.getPendingBookings()
      this.setData({ bookings, loading: false })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  async handleApprove(e) {
    const id = e.currentTarget.dataset.id
    try {
      await api.approveBooking(id)
      wx.showToast({ title: '已批准', icon: 'success' })
      this.loadBookings()
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    }
  },

  async handleReject(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '拒绝原因',
      content: '请确认是否拒绝此预订',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.rejectBooking(id, '场地原因')
            wx.showToast({ title: '已拒绝', icon: 'success' })
            this.loadBookings()
          } catch (err) {
            wx.showToast({ title: err.message || '操作失败', icon: 'none' })
          }
        }
      }
    })
  }
})
