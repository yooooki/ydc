import { Context } from 'koishi'

import type { RuntimeContext } from '../runtime'

// 返回 ysm 的随机吐槽。
export function registerYsmCommand(ctx: Context, _runtime: RuntimeContext) {
    ctx.command('ysm', { hidden: true })
        .action(() => {
            return Math.random() > 0.5 ? '太晒妹了，别恶心我' : '太恶心了，别晒妹我'
        })
}
