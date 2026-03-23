// pages/owner/venues.js
const api = require('../../utils/api.js')

const TYPE_MAP = {
  badminton: '羽毛球',
  basketball: '篮球',
  football: '足球',
  tennis: '网球',
  table_tennis: '乒乓球',
  other: '其他'
}

Page({
  data: {
    venues: [],
    loading: true
  },

  onShow() {
    this.loadVenues()
  },

  async loadVenues() {
    this.setData({ loading: true })
    try {
      const venues = await api.getMyVenues()
      const venuesWithTypeText = venues.map(v => ({
        ...v,
        typeText: TYPE_MAP[v.type] || v.type
      }))
      this.setData({ venues: venuesWithTypeText, loading: false })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  goToCreateVenue() {
    wx.navigateTo({ url: '/pages/owner/venue-edit/venue-edit' })
  },

  goToEditVenue(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/owner/venue-edit/venue-edit?id=${id}` })
  },

  async toggleStatus(e) {
    const id = e.currentTarget.dataset.id
    const currentStatus = e.currentTarget.dataset.status
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    try {
      await api.updateVenueStatus(id, newStatus)
      wx.showToast({
        title: newStatus === 'active' ? '已启用' : '已禁用',
        icon: 'success'
      })
      this.loadVenues()
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    }
  },

  async deleteVenue(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除该场地吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.deleteVenue(id)
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadVenues()
          } catch (err) {
            wx.showToast({ title: err.message || '删除失败', icon: 'none' })
          }
        }
      }
    })
  }
})
