// pages/owner/venue-edit/venue-edit.js
const api = require('../../utils/api.js')

const VENUE_TYPES = [
  { value: 'badminton', label: '羽毛球' },
  { value: 'basketball', label: '篮球' },
  { value: 'football', label: '足球' },
  { value: 'tennis', label: '网球' },
  { value: 'table_tennis', label: '乒乓球' },
  { value: 'other', label: '其他' }
]

const SLOT_DURATIONS = [30, 60, 90, 120]
const CANCEL_HOURS_OPTIONS = [1, 2, 4, 6, 12, 24]

function getTypeIndex(type) {
  return VENUE_TYPES.findIndex(t => t.value === type)
}

function getSlotDurationIndex(duration) {
  const idx = SLOT_DURATIONS.indexOf(duration)
  return idx >= 0 ? idx : 1
}

function getCancelHoursIndex(hours) {
  const idx = CANCEL_HOURS_OPTIONS.indexOf(hours)
  return idx >= 0 ? idx : 1
}

Page({
  data: {
    isEdit: false,
    venueId: '',
    venueTypes: VENUE_TYPES,
    slotDurations: SLOT_DURATIONS,
    cancelHoursOptions: CANCEL_HOURS_OPTIONS,
    formData: {
      name: '',
      type: 'badminton',
      typeIndex: 0,
      address: '',
      description: '',
      images: [],
      open_time_start: '08:00',
      open_time_end: '22:00',
      slot_duration: 60,
      slot_price: 50,
      require_approval: false,
      cancel_hours: 2,
      status: 'active'
    },
    loading: false,
    submitting: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, venueId: options.id })
      wx.setNavigationBarTitle({ title: '编辑场地' })
      this.loadVenue(options.id)
    } else {
      wx.setNavigationBarTitle({ title: '创建场地' })
    }
  },

  async loadVenue(id) {
    this.setData({ loading: true })
    try {
      const venue = await api.getVenue(id)
      const typeIndex = getTypeIndex(venue.type || 'badminton')
      const slotDuration = venue.slot_duration || 60
      const cancelHours = venue.cancel_hours || 2
      const formData = {
        name: venue.name || '',
        type: venue.type || 'badminton',
        typeIndex: typeIndex >= 0 ? typeIndex : 0,
        address: venue.address || '',
        description: venue.description || '',
        images: venue.images || [],
        open_time_start: (venue.open_time && venue.open_time.start) || '08:00',
        open_time_end: (venue.open_time && venue.open_time.end) || '22:00',
        slot_duration: slotDuration,
        slotDurationIndex: getSlotDurationIndex(slotDuration),
        slot_price: venue.slot_price || 50,
        require_approval: venue.require_approval || false,
        cancel_hours: cancelHours,
        cancelHoursIndex: getCancelHoursIndex(cancelHours),
        status: venue.status || 'active'
      }
      this.setData({ formData, loading: false })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  onNameInput(e) {
    this.setData({ 'formData.name': e.detail.value })
  },

  onTypeChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({
      'formData.typeIndex': index,
      'formData.type': VENUE_TYPES[index].value
    })
  },

  onAddressInput(e) {
    this.setData({ 'formData.address': e.detail.value })
  },

  onDescriptionInput(e) {
    this.setData({ 'formData.description': e.detail.value })
  },

  onOpenTimeStartChange(e) {
    this.setData({ 'formData.open_time_start': e.detail.value })
  },

  onOpenTimeEndChange(e) {
    this.setData({ 'formData.open_time_end': e.detail.value })
  },

  onSlotDurationChange(e) {
    const val = SLOT_DURATIONS[parseInt(e.detail.value)]
    this.setData({
      'formData.slotDurationIndex': parseInt(e.detail.value),
      'formData.slot_duration': val
    })
  },

  onSlotPriceChange(e) {
    this.setData({ 'formData.slot_price': parseFloat(e.detail.value) || 0 })
  },

  onRequireApprovalChange(e) {
    this.setData({ 'formData.require_approval': e.detail.value })
  },

  onCancelHoursChange(e) {
    const val = CANCEL_HOURS_OPTIONS[parseInt(e.detail.value)]
    this.setData({
      'formData.cancelHoursIndex': parseInt(e.detail.value),
      'formData.cancel_hours': val
    })
  },

  onStatusChange(e) {
    this.setData({ 'formData.status': e.detail.value ? 'active' : 'inactive' })
  },

  async chooseImage() {
    const { formData } = this.data
    if (formData.images.length >= 5) {
      wx.showToast({ title: '最多上传5张图片', icon: 'none' })
      return
    }
    try {
      const res = await new Promise((resolve, reject) => {
        wx.chooseImage({
          count: 5 - formData.images.length,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject
        })
      })
      const tempFilePaths = res.tempFilePaths
      const uploadedUrls = []
      for (const path of tempFilePaths) {
        try {
          const url = await this.uploadImage(path)
          uploadedUrls.push(url)
        } catch (err) {
          console.error('上传图片失败', err)
        }
      }
      if (uploadedUrls.length > 0) {
        this.setData({
          'formData.images': [...formData.images, ...uploadedUrls]
        })
      }
    } catch (err) {
      if (err.errMsg && !err.errMsg.includes('cancel')) {
        wx.showToast({ title: '选择图片失败', icon: 'none' })
      }
    }
  },

  uploadImage(filePath) {
    return new Promise((resolve) => {
      wx.uploadFile({
        url: 'http://localhost:8000/api/upload/image',
        filePath: filePath,
        name: 'image',
        header: {
          'Authorization': api.getToken() ? `Bearer ${api.getToken()}` : ''
        },
        success: (res) => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(res.data)
              resolve(data.url || data.path || filePath)
            } catch {
              resolve(filePath)
            }
          } else {
            resolve(filePath)
          }
        },
        fail: () => {
          resolve(filePath)
        }
      })
    })
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index
    const { formData } = this.data
    const images = [...formData.images]
    images.splice(index, 1)
    this.setData({ 'formData.images': images })
  },

  previewImage(e) {
    const urls = this.data.formData.images
    wx.previewImage({
      current: urls[e.currentTarget.dataset.index],
      urls: urls
    })
  },

  async submitForm() {
    const { formData, isEdit } = this.data

    if (!formData.name.trim()) {
      wx.showToast({ title: '请输入场地名称', icon: 'none' })
      return
    }
    if (!formData.address.trim()) {
      wx.showToast({ title: '请输入场地地址', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      address: formData.address.trim(),
      description: formData.description.trim(),
      images: formData.images,
      open_time: {
        start: formData.open_time_start,
        end: formData.open_time_end
      },
      slot_duration: formData.slot_duration,
      require_approval: formData.require_approval,
      cancel_hours: formData.cancel_hours
    }

    try {
      if (isEdit) {
        await api.updateVenue(this.data.venueId, payload)
        wx.showToast({ title: '更新成功', icon: 'success' })
      } else {
        await api.createVenue(payload)
        wx.showToast({ title: '创建成功', icon: 'success' })
      }
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (err) {
      this.setData({ submitting: false })
      wx.showToast({ title: err.message || (isEdit ? '更新失败' : '创建失败'), icon: 'none' })
    }
  }
})
