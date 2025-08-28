// getDeliveryStats/index.js
const cloud = require('wx-server-sdk')

// 加载环境变量
require('dotenv').config()

// 配置腾讯云API密钥
cloud.init({
  env: process.env.CLOUD_ENV || 'cloudbase-5gwmm58bd5cec13f', // 使用环境变量或默认环境
  secretId: process.env.TENCENT_SECRET_ID,
  secretKey: process.env.TENCENT_SECRET_KEY
})

const db = cloud.database()

// 获取配送统计数据
exports.main = async (event, context) => {
  // 主函数处理不同类型的请求
  if (event.type === 'getReport') {
    return await getReportData(event);
  }
  
  // 获取服务器时间
  if (event.type === 'getServerTime') {
    try {
      const serverDate = await db.serverDate();
      // 转换为标准时间戳，避免RangeError
      const timestamp = serverDate.getTime();
      return {
        success: true,
        data: {
          serverTime: timestamp
        }
      };
    } catch (error) {
      console.error('获取服务器时间失败:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
  const { date, operator, userId } = event
  
  // 统一用户标识处理：优先使用userId，如果没有则使用operator
  const userIdentifier = userId || operator
  
  try {
    // 获取服务器时间
    const serverDate = await db.serverDate()
    
    // 获取今日配送量
    const today = serverDate.toISOString().split('T')[0]
    const todayStats = await getDailyStats(today, userIdentifier)
    
    // 获取本月配送量
    const monthStart = today.substring(0, 7) + '-01'
    const monthStats = await getMonthStats(monthStart, today, userIdentifier)
    
    // 获取总配送量
    const totalStats = await getTotalStats(userIdentifier)
    
    // 获取近7日数据用于图表
    const sevenDaysStats = await getSevenDaysStats(userIdentifier)
    
    return {
      success: true,
      data: {
        todayCount: todayStats,
        monthCount: monthStats,
        totalCount: totalStats,
        dailyStats: sevenDaysStats
      }
    }
    
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return {
      success: false,
      message: error.message,
      error: error
    }
  }
}

// 获取单日统计数据
async function getDailyStats(date, openid) {
  try {
    const res = await db.collection('delivery_stats')
      .where({
        date: date,
        openid: openid
      })
      .get()
    
    if (res.data.length > 0) {
      return res.data[0].deliveryCount || 0
    }
    return 0
  } catch (error) {
    console.error('获取单日统计失败:', error)
    return 0
  }
}

// 获取月度统计数据
async function getMonthStats(startDate, endDate, openid) {
  try {
    const { data } = await db.collection('delivery_stats')
      .where({
        operator: openid,
        date: db.command.and(db.command.gte(startDate), db.command.lte(endDate))
      })
      .field({ date: 1, deliveryCount: 1 })
      .get()

    // 计算月度配送总量（所有日期的deliveryCount相加）
    const monthlyTotal = data.reduce((sum, stat) => sum + (stat.deliveryCount || 0), 0)

    return {
      month: startDate.substring(0, 7),
      total: monthlyTotal,
      dailyDetails: data
    }
  } catch (error) {
    console.error('获取月度统计失败:', error)
    return { month: startDate.substring(0, 7), total: 0, dailyDetails: [] }
  }
}

// 获取总配送量
async function getTotalStats(openid) {
  try {
    const res = await db.collection('delivery_stats')
      .where({
        operator: openid
      })
      .get()
    
    let total = 0
    res.data.forEach(stat => {
      total += stat.deliveryCount || 0
    })
    
    return total
  } catch (error) {
    console.error('获取总统计失败:', error)
    return 0
  }
}

// 获取近7日统计数据
async function getSevenDaysStats(openid) {
  try {
    const dates = []
    const serverDate = await db.serverDate()
    const today = new Date(serverDate)
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      dates.push(dateStr)
    }
    
    const res = await db.collection('delivery_stats')
      .where({
        operator: openid,
        date: db.command.in(dates)
      })
      .get()
    
    // 构建包含所有日期的结果，即使没有数据
    const result = dates.map(date => {
      const stat = res.data.find(d => d.date === date)
      return {
        date: date,
        deliveryCount: stat ? stat.deliveryCount : 0
      }
    })
    
    return result
  } catch (error) {
    console.error('获取7日统计失败:', error)
    return []
  }
}

// 格式化统计数据
async function getFormattedStats(startDate, endDate, openid, mode) {
  try {
    const res = await db.collection('delivery_stats')
      .where({
        operator: openid,
        date: mode === 'month' 
          ? db.command.gte(startDate).lte(endDate)
          : db.command.eq(startDate)
      })
      .get()