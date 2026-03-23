// pages/venue/detail.js
const api = require('../../utils/api.js')

Page({
  data: {
    venue: null,
    slots: [],
    selectedDate: '',
    loading: true,
    dates: []
  },

  onLoad(options) {
    this.loadVenue(options.id)
    this.initDates()
  },

  async loadVenue(id) {
    this.setData({ loading: true })
    try {
      const venue = await api.getVenue(id)
      this.setData({ venue, loading: false })
      if (this.data.selectedDate) {
        this.loadSlots()
      }
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  initDates() {
    const dates = []
    const today = new Date()
    for (let i = 0; i < 7; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      dates.push({
        date: d.toISOString().split('T')[0],
        label: i === 0 ? '今天' : i === 1 ? '明天' : d.getMonth() + 1 + '月' + d.getDate() + '日',
        day: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
      })
    }
    this.setData({ dates, selectedDate: dates[0].date }, () => {
      this.loadSlots()
    })
  },

  async loadSlots() {
    const { venue, selectedDate } = this.data
    if (!venue) return
    try {
      const slots = await api.getVenueSlots(venue._id, selectedDate)
      this.setData({ slots })
    } catch (err) {
      wx.showToast({ title: '时段加载失败', icon: 'none' })
    }
  },

  onDateChange(e) {
    const index = e.detail.value
    const date = this.data.dates[index].date
    this.setData({ selectedDate: date }, () => {
      this.loadSlots()
    })
  },

  goBooking(e) {
    const slot = e.currentTarget.dataset.slot
    const { venue } = this.data
    wx.navigateTo({
      url: `/pages/booking/create?venueId=${venue._id}&slotId=${slot._id}`
    })
  }
})
