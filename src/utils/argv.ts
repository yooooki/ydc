import type { Argv, Session } from 'koishi'
import type { CsmScope } from '../config'

// 确保命令参数里存在可用的 session。
export function ensureSession(argv: Argv): Session {
    if (!argv.session) {
        throw new Error('session is required for this command path')
    }
    return argv.session
}

// 按 key 读取命令选项并保留类型信息。
export function getOption<O extends object, K extends keyof O>(
    argv: Argv<any, any, any[], O>,
    key: K,
): O[K] | undefined {
    return argv.options?.[key]
}

// accept 命令参数展开后的结果。
export interface RangeParseResult {
    values: number[]
    errorMessage: string
}

// 展开 accept 命令里的单个编号和区间参数。
export function parseAcceptArgs(rawArgs: string[]): RangeParseResult {
    let errorMessage = ''
    const values: number[] = []

    for (const rawArg of rawArgs) {
        if (/^\d+$/.test(rawArg)) {
            values.push(Number(rawArg))
            continue
        }
        const rangeMatch = rawArg.match(/^(\d+)-(\d+)$/)
        if (rangeMatch) {
            const start = Number(rangeMatch[1])
            const end = Number(rangeMatch[2])
            if (start <= end) {
                values.push(...[...Array(end - start + 1).keys()].map(i => i + start))
            } else {
                errorMessage += `\n错误序号: ${rawArg}，已忽略`
            }
            continue
        }
        errorMessage += `\n错误序号: ${rawArg}，已忽略`
    }

    return { values, errorMessage }
}

// 解析 csm 的查找范围。
export function resolveCsmScope(defaultScope: CsmScope, useGuild: boolean, useGlobal: boolean) {
    if (useGuild && useGlobal) {
        return { errorMessage: '不能同时指定本群和全局查找范围' }
    }
    if (useGuild) {
        return { scope: 'guild' as const }
    }
    if (useGlobal) {
        return { scope: 'global' as const }
    }
    return { scope: defaultScope }
}
