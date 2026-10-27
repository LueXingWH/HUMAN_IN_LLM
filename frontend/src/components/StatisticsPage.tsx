import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, Typography } from 'antd'

import { CosmicBackdrop } from './CosmicBackdrop'
import { StatisticsPanel } from './settings/StatisticsPanel'

export function StatisticsPage() {
  useEffect(() => {
    document.title = 'ChatAPI | 统计'
  }, [])

  return (
    <main className="statistics-page">
      <CosmicBackdrop />
      <div className="statistics-page-glow statistics-page-glow-left" aria-hidden="true" />
      <div className="statistics-page-glow statistics-page-glow-right" aria-hidden="true" />

      <div className="statistics-page-shell">
        <div className="statistics-page-header">
          <div className="statistics-page-copy">
            <Typography.Text className="eyebrow">CHATAPI</Typography.Text>
            <Typography.Title level={1} className="statistics-page-title">
             API 端点统计
            </Typography.Title>
            <Typography.Paragraph className="statistics-page-desc">
              请求、延迟、token 消耗
            </Typography.Paragraph>
          </div>

        <div className="statistics-page-actions">
          <Link className="action-btn btn-secondary statistics-page-action" to="/app">
            工作区
          </Link>
          <Link className="action-btn btn-primary statistics-page-action" to="/">
            返回首页
            </Link>
          </div>
        </div>

        <Card className="statistics-page-frame">
          <StatisticsPanel open />
        </Card>
      </div>
    </main>
  )
}
