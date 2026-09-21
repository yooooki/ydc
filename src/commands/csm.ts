import { $, Context, Random, h } from 'koishi'

import type { RuntimeContext } from '../runtime'

import { ensureSession, getOption, resolveCsmScope } from '../utils/argv'
import { getGuildUserImagePaths } from '../utils/files'
import { filePathsToImageElements } from '../utils/image'
import { formatDate } from '../utils/time'

// 随机抽取一条历史大餐记录。
export function registerCsmCommand(ctx: Context, runtime: RuntimeContext) {
    const cfg = runtime.config
    const rootPath = runtime.state.paths.root

    ctx.command('csm', '吃什么')
        .option('guild', '-g 只查本群记录')
        .option('global', '-a 查找全局记录')
        .usage('随机抽取一条历史大餐记录；多图记录会把所有图片合并在同一条消息里发送')
        .action(async (argv) => {
            const session = ensureSession(argv)
            const guildId = session.guildId
            const callerId = session.userId
            const quoteMessageId = session.messageId
            if (guildId == null) {
                return '只能在群聊中使用'
            }

            const scopeResult = resolveCsmScope(
                cfg.csmScopeDefault,
                !!getOption(argv, 'guild'),
                !!getOption(argv, 'global'),
            )
            if (scopeResult.errorMessage) {
                return scopeResult.errorMessage
            }

            const countQuery = ctx.database.select('dc_table')
            if (scopeResult.scope === 'guild') {
                countQuery.where(row => $.eq(row.channelId, guildId))
            }
            const count = await countQuery.execute(row => $.count(row.id))
            if (count <= 0) {
                return scopeResult.scope === 'guild' ? '本群还没有大餐记录' : '现在还没有大餐记录'
            }

            // 不能复用 countQuery，因为不同 db adapter 不能保证 execute 之后查询构造器还相同
            const recordQuery = ctx.database.select('dc_table')
            if (scopeResult.scope === 'guild') {
                recordQuery.where(row => $.eq(row.channelId, guildId))
            }
            const result = await recordQuery
                .orderBy('id')
                .offset(Random.int(0, count - 1))
                .limit(1)
                .execute()
            if (result.length !== 1) {
                return h('template', [
                    h.at(callerId),
                    ' 发生了一些事，只能摸了',
                ])
            }
            const record = result[0]
            let isUserInGroup = true
            try {
                await session.bot.getGuildMember(guildId, record.user)
            } catch {
                isUserInGroup = false
            }

            // 兼容旧版单图文件和新的多图文件夹
            const imageElements = await filePathsToImageElements(
                getGuildUserImagePaths(rootPath, record.channelId, record.user, record.path),
                false,
            )

            const tail = isUserInGroup
                ? callerId === record.user ? '你还想再吃一次吗?' : '不来一份吗?'
                : '虽然他不在群里，但他的大餐将一直陪伴着我们'

            const speaker = isUserInGroup ? h.at(record.user) : '其他群的群友'
            await session.send(h('p', h.quote(quoteMessageId), speaker,
                `在${formatDate(record.stamp)}吃了如下大餐`, h('br'),
                ...imageElements, tail))
        })
}
