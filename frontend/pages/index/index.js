// pages/index/index.js
const api = require('../../utils/api.js')

Page({
  data: {
    venues: [],
    loading: true,
    searchKey: '',
    selectedType: ''
  },

  types: [
    { value: '', label: '全部' },
    { value: 'badminton', label: '羽毛球' },
    { value: 'basketball', label: '篮球' },
    { value: 'football', label: '足球' },
    { value: 'tennis', label: '网球' },
    { value: 'table_tennis', label: '乒乓球' },
    { value: 'other', label: '其他' }
  ],

  onLoad() {
    this.loadVenues()
  },

  onShow() {
    // 每次显示刷新场地列表
    this.loadVenues()
  },

  async loadVenues() {
    this.setData({ loading: true })
    try {
      const params = {}
      if (this.data.searchKey) params.keyword = this.data.searchKey
      if (this.data.selectedType) params.type = this.data.selectedType
      const venues = await api.getVenues(params)
      this.setData({ venues, loading: false })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  onSearch(e) {
    this.setData({ searchKey: e.detail.value }, () => {
      this.loadVenues()
    })
  },

  onTypeChange(e) {
    const type = this.types[e.detail.value].value
    this.setData({ selectedType: type }, () => {
      this.loadVenues()
    })
  },

  onTypeTap(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ selectedType: type }, () => {
      this.loadVenues()
    })
  },

  goToVenue(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/venue/detail?id=${id}` })
  }
})
