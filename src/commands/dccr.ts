import { $, Context, Random, h } from 'koishi'

import type { RuntimeContext } from '../runtime'

import { ensureSession, getOption } from '../utils/argv'
import { getGuildUserImagePaths } from '../utils/files'
import { filePathsToImageElements } from '../utils/image'
import { extractSingleAtId } from '../utils/message'
import { formatDate, parseDateRange } from '../utils/time'

// 查询某人的历史大餐罪证。
export function registerDccrCommand(ctx: Context, runtime: RuntimeContext) {
    const rootPath = runtime.state.paths.root

    ctx.command('dccr <arg0:string>', '大餐criminal record')
        .option('noramdom', '-z')
        .option('norandom', '--nr', { value: true })
        .option('date', '-d <date:string>')
        .usage('dccr @罪人 [--nr] [-d 起始日期[~结束日期]]')
        .action(async (argv, arg0) => {
            const session = ensureSession(argv)
            if (!arg0) {
                return '错误用法'
            }
            const noRandom = !!getOption(argv, 'noramdom') || !!getOption(argv, 'norandom')
            const rand = !noRandom
            const guildId = session.guildId
            if (guildId == null) {
                return '只能在群聊中使用'
            }
            const userId = extractSingleAtId(arg0)
            if (!userId) {
                return '错误用法'
            }

            // 解析可选的日期范围
            const dateOption = getOption(argv, 'date')
            let startDate: Date | undefined
            let endDate: Date | undefined
            if (dateOption) {
                const range = parseDateRange(String(dateOption))
                if (!range) {
                    return '日期格式不合法，正确格式为"起始日期[~结束日期]"'
                }
                startDate = range.start
                endDate = range.end
            }

            const records = await ctx.database.select('dc_table')
                .where(row => $.and($.eq(row.user, userId), $.eq(row.channelId, guildId)))
                .orderBy(row => row.stamp, 'desc')
                .execute()

            if (records.length == 0) {
                return h('p', h.at(userId), '无罪')
            }

            let record = records[0]
            let randomPickRange = records
            let guiltPrefix = ''

            if (startDate) {
                const inRange = records.filter(r => r.stamp > startDate! && r.stamp < endDate!)
                if (inRange.length > 0) {
                    randomPickRange = inRange
                    record = inRange[0]
                } else {
                    // 该时间段没有罪证时，找离起始日期最近的一条作为展示
                    guiltPrefix = '尽管那几天无罪，'
                    let nearest = records[0]
                    let minDiff = Math.abs(startDate.getTime() - nearest.stamp.getTime())
                    for (const r of records) {
                        const diff = Math.abs(startDate.getTime() - r.stamp.getTime())
                        if (diff < minDiff) {
                            minDiff = diff
                            nearest = r
                        }
                    }
                    record = nearest
                    randomPickRange = [nearest]
                }
            }

            if (rand) {
                record = Random.pick(randomPickRange)
            }

            const imageElements = await filePathsToImageElements(
                getGuildUserImagePaths(rootPath, guildId, userId, record.path),
                false,
            )
            const otherGuilt = records.length === 1
                ? '除此之外是清白的，暂时'
                : `除此之外还有${records.length - 1}条罪证`
            return h('p', guiltPrefix, h.at(userId), `于${formatDate(record.stamp)}`, '的罪证在此:', ...imageElements, otherGuilt)
        })
}
