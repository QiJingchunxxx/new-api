package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// GetLandingStats 返回首页数据条的统计快照（公开接口）。
//
// 只下发聚合后的数字，不包含任何用户、渠道或 Key 维度信息。
func GetLandingStats(c *gin.Context) {
	common.ApiSuccess(c, service.GetLandingStats())
}

// RecordLandingVisit 记录一次落地页访问（公开接口）。
//
// 前端在首页挂载时调用一次；计数先在内存累加，由后台任务批量落库。
func RecordLandingVisit(c *gin.Context) {
	service.RecordLandingVisit()
	common.ApiSuccess(c, gin.H{"ok": true})
}
