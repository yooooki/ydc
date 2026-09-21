import { Context, h } from 'koishi'

import type { RuntimeContext } from '../runtime'

import { ensureSession } from '../utils/argv'
import { formatDate } from '../utils/time'

interface Winner {
  id: string
  times: number
}

// 从计数表里找出次数最多的人；没有记录时返回 undefined。
function findWinner(counts: Record<string, number>): Winner | undefined {
  let id = ''
  let times = 0
  for (const [userId, count] of Object.entries(counts)) {
    if (count > times) {
      id = userId
      times = count
    }
  }
  return id ? { id, times } : undefined
}

// 统计并显示当前群最近 7 天 / 30 天的大餐王。
export function registerDcwCommand(ctx: Context, runtime: RuntimeContext) {
  ctx.command('dcw', '查看本周/本月大餐王')
    .usage('直接计算当前群最近 7 天和最近 30 天的大餐王')
    .action(async (argv) => {
      const session = ensureSession(argv)
      const guildId = session.guildId
      if (guildId == null) {
        return '只能在群聊中使用'
      }

      const day = 1000 * 60 * 60 * 24
      const stamp = session.event.timestamp
      const now = new Date(stamp)
      const lastWeek = new Date(stamp - day * 7)
      const lastMonth = new Date(stamp - day * 30)

      // 只统计已入库的正式记录，不统计待审核记录。
      const records = await ctx.database.get('dc_table', {
        channelId: guildId,
        stamp: { $gt: lastMonth },
      })

      const weeklyCounts: Record<string, number> = {}
      const monthlyCounts: Record<string, number> = {}
      for (const record of records) {
        if (record.channelId !== guildId) continue
        monthlyCounts[record.user] = (monthlyCounts[record.user] ?? 0) + 1
        if (record.stamp >= lastWeek) {
          weeklyCounts[record.user] = (weeklyCounts[record.user] ?? 0) + 1
        }
      }

      const weeklyWinner = findWinner(weeklyCounts)
      const monthlyWinner = findWinner(monthlyCounts)

      return h('template', [
        `一周大餐王(${formatDate(lastWeek)}~${formatDate(now)}):`, h('br'),
        ...(weeklyWinner
          ? [h.at(weeklyWinner.id), ` 大餐${weeklyWinner.times}次`]
          : ['本周暂无大餐王']),
        h('br'),
        h('br'),
        `一月大餐王(${formatDate(lastMonth)}~${formatDate(now)}):`, h('br'),
        ...(monthlyWinner
          ? [h.at(monthlyWinner.id), ` 大餐${monthlyWinner.times}次`]
          : ['本月暂无大餐王']),
      ])
    })
}
