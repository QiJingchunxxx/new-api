package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// LandingVisitStat 落地页访问量按天计数。
//
// 只保留「某天有多少次访问」这一个维度，用于首页数据条展示站点活跃度。
type LandingVisitStat struct {
	StatDate    string `json:"stat_date" gorm:"primaryKey;type:varchar(10)"`
	VisitCount  int64  `json:"visit_count" gorm:"default:0"`
	UpdatedTime int64  `json:"updated_time" gorm:"bigint"`
}

func (LandingVisitStat) TableName() string {
	return "landing_visit_stats"
}

// AddLandingVisits 累加某天的访问量。
//
// 先尝试原地累加，没有该日期的记录时再插入；插入撞主键说明并发中对方已写入，
// 此时退回累加，保证不会因为并发而丢计数。
func AddLandingVisits(date string, delta int64) error {
	if delta <= 0 {
		return nil
	}
	now := common.GetTimestamp()
	result := DB.Model(&LandingVisitStat{}).
		Where("stat_date = ?", date).
		UpdateColumns(map[string]any{
			"visit_count":  gorm.Expr("visit_count + ?", delta),
			"updated_time": now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected > 0 {
		return nil
	}
	stat := LandingVisitStat{
		StatDate:    date,
		VisitCount:  delta,
		UpdatedTime: now,
	}
	if err := DB.Create(&stat).Error; err != nil {
		return DB.Model(&LandingVisitStat{}).
			Where("stat_date = ?", date).
			UpdateColumns(map[string]any{
				"visit_count":  gorm.Expr("visit_count + ?", delta),
				"updated_time": now,
			}).Error
	}
	return nil
}

// GetLandingVisits 读取某天的访问量，没有记录时返回 0。
func GetLandingVisits(date string) (int64, error) {
	var stat LandingVisitStat
	err := DB.Where("stat_date = ?", date).First(&stat).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return stat.VisitCount, nil
}

// CountActiveUsers 返回注册用户总数，用于落地页展示站点规模。
func CountActiveUsers() (int64, error) {
	var count int64
	if err := DB.Model(&User{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
