// app.js
App({
  onLaunch: function () {
    this.globalData = {
      // env 参数说明：
      //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个极环境的资源
      //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
      //   如不填则使用默认环境（第一个创建的环境）
      env: "cloudbase-5gwmm58bd5cec13f" // 云开发环境ID
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }

    // 初始化全局事件通道
    this.initEventChannel();
  },







  // 初始化后台数据
  initBackgroundData() {
    // 检查是否支持后台数据获取
    if (wx.getBackgroundFetchData) {
      try {
        wx.getBackgroundFetchData({
          fetchType: 'periodic',
          success: (res) => {
            console.log('后台数据获取成功:', res);
            // 处理后台数据
            this.globalData.backgroundData = res;
          },
          fail: (err) => {
            // 忽略后台数据获取失败，不影响小程序正常使用
            console.warn('后台数据获取失败，但不影响小程序正常使用:', err);
            // 后台数据获取失败不影响小程序正常使用
            this.globalData.backgroundData = null;
          }
        });
      } catch (error) {
        // 捕获并忽略异常，不影响小程序正常使用
        console.warn('后台数据获取异常，但不影响小程序正常使用:', error);
        this.globalData.backgroundData = null;
      }
    }
  },

  // 初始化全局事件通道
  initEventChannel() {
    // 创建全局事件通道，用于页面间通信
    this.globalData.eventChannel = {
      // 事件监听器存储
      _events: {},
      
      // 监听事件
      on(event, callback) {
        if (!this._events[event]) {
          this._events[event] = [];
        }
        this._events[event].push(callback);
      },
      
      // 触发事件
      emit(event, data) {
        if (this._events[event]) {
          this._events[event].forEach(callback => {
            callback(data);
          });
        }
      },
      
      // 移除监听
      off(event, callback) {
        if (this._events[event]) {
          if (callback) {
            this._events[event] = this._events[event].filter(cb => cb !== callback);
          } else {
            delete this._events[event];
          }
        }
      }
    };
  },

  // 全局用户信息
  globalData: {
    userInfo: null,
    isAdmin: false,
    eventChannel: null
  },
