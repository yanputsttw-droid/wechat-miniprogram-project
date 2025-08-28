const cloud = require('wx-server-sdk');

// 初始化云函数
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * 计算清理时间边界（6个月前）
 * @returns {Date} 清理时间边界
 */
function calculateCutoffDate() {
  const now = new Date();
  
  // 计算6个月前的准确日期（保留6个月数据）
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(now.getMonth() - 6);
  
  // 使用UTC时间创建当月1日00:00:00，避免时区问题
  const cutoff = new Date(Date.UTC(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1, 0, 0, 0, 0));
  
  return cutoff;
}

/**
 * 清理指定集合的过期数据
 * @param {string} collectionName 集合名称
 * @param {Date} cutoffDate 清理时间边界
 * @returns {Promise<Object>} 清理结果
 */
async function cleanupCollection(collectionName, cutoffDate) {
  const db = cloud.database();
  const _ = db.command;
  
  try {
    console.log(`开始清理集合: ${collectionName}, 时间边界: ${cutoffDate.toISOString()}`);
    
    // 查询过期数据
    const queryResult = await db.collection(collectionName)
      .where({
        createTime: _.lt(cutoffDate)
      })
      .get();
    
    console.log(`集合 ${collectionName} 找到 ${queryResult.data.length} 条过期数据`);
    
    // 分批删除数据（避免超时）
    let deletedCount = 0;
    const batchSize = 100; // 每批处理100条
    
    for (let i = 0; i < queryResult.data.length; i += batchSize) {
      const batch = queryResult.data.slice(i, i + batchSize);
      const deletePromises = batch.map(record => 
        db.collection(collectionName).doc(record._id).remove()
      );
      
      await Promise.all(deletePromises);
      deletedCount += batch.length;
      
      console.log(`已删除 ${deletedCount}/${queryResult.data.length} 条数据`);
    }
    
    return {
      collection: collectionName,
      deleted: deletedCount,
      total: queryResult.data.length
    };
    
  } catch (error) {
    console.error(`清理集合 ${collectionName} 时发生错误:`, error);
    throw error;
  }
}

/**
 * 记录清理结果日志
 * @param {Object} statsResult delivery_stats 清理结果
 * @param {Object} scanResult scan_records 清理结果
 * @param {Date} cutoffDate 清理时间边界
 */
function logCleanupResult(statsResult, scanResult, cutoffDate) {
  console.log('数据清理执行完成:');
  console.log(`- 清理时间边界: ${cutoffDate.toISOString()}`);
  console.log(`- ${statsResult.collection}: 删除 ${statsResult.deleted} 条记录`);
  console.log(`- ${scanResult.collection}: 删除 ${scanResult.deleted} 条记录`);
  console.log(`- 总计删除: ${statsResult.deleted + scanResult.deleted} 条记录`);
  console.log(`- 执行时间: ${new Date().toISOString()}`);
}

/**
 * 主函数 - 数据清理入口
 */
async function main() {
  try {
    console.log('开始执行数据清理任务...');
    const startTime = Date.now();
    
    // 1. 计算清理时间边界
    const cutoffDate = calculateCutoffDate();
    console.log(`计算出的清理时间边界: ${cutoffDate.toISOString()}`);
    
    // 2. 清理 delivery_stats 集合
    const statsResult = await cleanupCollection('delivery_stats', cutoffDate);
    
    // 3. 清理 scan_records 集合
    const scanResult = await cleanupCollection('scan_records', cutoffDate);
    
    // 4. 记录清理结果
    logCleanupResult(statsResult, scanResult, cutoffDate);
    
    const executionTime = Date.now() - startTime;
    console.log(`数据清理任务完成，耗时: ${executionTime}ms`);
    
    return {
      success: true,
      stats: statsResult,
      scans: scanResult,
      cutoffDate: cutoffDate.toISOString(),
      executionTime: executionTime
    };
    
  } catch (error) {
    console.error('数据清理任务执行失败:', error);
    
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// 云函数入口
// 注意：微信云函数需要导出 main 函数
module.exports = { 
  main,
  calculateCutoffDate,
  cleanupCollection,
  logCleanupResult
};