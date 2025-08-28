// cloudfunctions/fixUsernames/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    console.log('开始修复用户名数据...')
    
    // 1. 查询所有 username 为 null 或 undefined 的用户
    const usersWithNullUsername = await db.collection('users')
      .where({
        username: db.command.exists(false)
      })
      .get()
    
    console.log(`找到 ${usersWithNullUsername.data.length} 个 username 为 null 的用户`)
    
    // 2. 逐个修复这些用户
    const updatePromises = usersWithNullUsername.data.map(async (user) => {
      try {
        console.log(`修复用户 ${user._id}，将 username 设置为 ${user.openid}`)
        
        const updateResult = await db.collection('users')
          .doc(user._id)
          .update({
            data: {
              username: user.openid,
              updateTime: db.serverDate()
            }
          })
        
        console.log(`用户 ${user._id} 修复成功`)
        return {
          userId: user._id,
          success: true,
          updated: updateResult.stats.updated
        }
      } catch (error) {
        console.error(`修复用户 ${user._id} 失败:`, error)
        return {
          userId: user._id,
          success: false,
          error: error.message
        }
      }
    })
    
    // 3. 等待所有更新完成
    const results = await Promise.all(updatePromises)
    
    // 4. 统计结果
    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length
    
    console.log(`修复完成: 成功 ${successCount} 个，失败 ${failureCount} 个`)
    
    return {
      success: true,
      message: `修复完成: 成功 ${successCount} 个，失败 ${failureCount} 个`,
      results: results
    }
    
  } catch (error) {
    console.error('修复用户名数据失败:', error)
    return {
      success: false,
      message: '修复用户名数据失败',
      error: error.message
    }
  }
}