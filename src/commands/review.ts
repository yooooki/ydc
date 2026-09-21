import { Context, h } from 'koishi'

import type { RuntimeContext } from '../runtime'

import { ensureSession, getOption } from '../utils/argv'
import { getTempImagePaths } from '../utils/files'
import { filePathsToImageElements } from '../utils/image'

// 查看待审核的大餐记录。
export function registerReviewCommand(ctx: Context, runtime: RuntimeContext) {
    const cfg = runtime.config
    const tempPath = runtime.state.paths.temp

    ctx.command('review [num:number]', { hidden: true })
        .option('num', '-n <val:number>', { fallback: 10 })
        .usage('查看待审核的大餐记录。可以传一个正整数控制显示数量，例如：review 5 或 review -n 5')
        .action(async (argv, num) => {
            const session = ensureSession(argv)
            const userId = session.userId!
            if (userId !== cfg.master && !cfg.readers.includes(userId)) {
                return h.at(userId) + ' 你不能那么做'
            }

            // 优先使用位置参数，其次使用 -n 选项，最后默认 10。
            const optionValue = getOption(argv, 'num')
            const rawNum = num ?? optionValue ?? 10
            if (!Number.isInteger(rawNum) || rawNum <= 0) {
                return '数量必须是正整数'
            }
            const limit = rawNum

            let idx = 0
            const pendingDcs = await ctx.database.get('pending_dc_table', {})
            await session.send(`共有${pendingDcs.length}条大餐待审核`)
            await ctx.sleep(1000)
            for (const pendingDc of pendingDcs) {
                if (++idx > limit) {
                    await session.send(`显示${limit}条`)
                    break
                }
                // 兼容旧版单图文件和新的多图文件夹
                const imageElements = await filePathsToImageElements(
                    getTempImagePaths(tempPath, pendingDc.path),
                    true,
                )
                await session.send(`
id: ${pendingDc.id}
guild: ${pendingDc.channelId}
user: ${pendingDc.user}
image:
` + imageElements.join(''))
                await ctx.sleep(1000)
            }
            await ctx.sleep(500)
            await session.send(`以上`)
            return
        })
}
