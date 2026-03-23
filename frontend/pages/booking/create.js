// pages/booking/create.js
const api = require('../../utils/api.js')

Page({
  data: {
    venueId: '',
    slotId: '',
    venue: null,
    slot: null,
    contactName: '',
    contactPhone: '',
    loading: false
  },

  onLoad(options) {
    this.setData({
      venueId: options.venueId,
      slotId: options.slotId
    })
    this.loadData()
  },

  async loadData() {
    try {
      const [venue, slots] = await Promise.all([
        api.getVenue(this.data.venueId),
        api.getVenueSlots(this.data.venueId, '')
      ])
      const slot = slots.find(s => s._id === this.data.slotId)
      this.setData({ venue, slot })
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onContactNameChange(e) {
    this.setData({ contactName: e.detail.value })
  },

  onContactPhoneChange(e) {
    this.setData({ contactPhone: e.detail.value })
  },

  validate() {
    if (!this.data.contactName.trim()) {
      wx.showToast({ title: '请输入联系人姓名', icon: 'none' })
      return false
    }
    if (!/^1\d{10}$/.test(this.data.contactPhone)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' })
      return false
    }
    return true
  },

  async handleSubmit() {
    if (!this.validate()) return
    if (this.data.loading) return

    this.setData({ loading: true })
    try {
      await api.createBooking({
        venue_id: this.data.venueId,
        slot_id: this.data.slotId,
        services: [],
        contact_name: this.data.contactName.trim(),
        contact_phone: this.data.contactPhone.trim()
      })
      wx.showToast({ title: '预订成功', icon: 'success' })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/my/bookings' })
      }, 1500)
    } catch (err) {
      wx.showModal({
        title: '预订失败',
        content: err.message || '请稍后重试',
        showCancel: false
      })
    } finally {
      this.setData({ loading: false })
    }
  }
})
