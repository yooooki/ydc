import fs from 'node:fs'
import path from 'node:path'
import type { Context } from 'koishi'
import type { Config } from './config'

// 插件运行时使用的目录集合。
export interface RuntimePaths {
    root: string
    temp: string
}

// 插件运行时使用的互斥锁集合。
export interface RuntimeLocks {
    ydc: Record<string, boolean>
}

// 插件运行期共享状态。
export interface RuntimeState {
    paths: RuntimePaths
    locks: RuntimeLocks
}

// 传递给各命令模块的运行时上下文。
export interface RuntimeContext {
    config: Config
    state: RuntimeState
}

// 基于配置构造运行期共享状态。
export function createRuntime(config: Config): RuntimeContext {
    const rootPath = path.join('.', config.dataDir)
    return {
        config,
        state: {
            paths: {
                root: rootPath,
                temp: path.join(rootPath, 'tmp'),
            },
            locks: {
                ydc: {},
            },
        },
    }
}

// 读取某个群当前的锁状态。
export function getGuildLock(lockTable: Record<string, boolean>, guildId: string) {
    return lockTable[guildId] === true
}

// 写入某个群当前的锁状态。
export function setGuildLock(lockTable: Record<string, boolean>, guildId: string, locked: boolean) {
    if (locked) {
        lockTable[guildId] = true
        return
    } 
    delete lockTable[guildId]
}

// 在 ready 阶段补齐数据目录和临时目录。
export function prepareRuntimeDirectories(ctx: Context, runtime: RuntimeContext) {
    ctx.on('ready', async () => {
        if (!fs.existsSync(runtime.state.paths.root)) {
            fs.mkdirSync(runtime.state.paths.root, { recursive: true })
        }
        if (!fs.existsSync(runtime.state.paths.temp)) {
            fs.mkdirSync(runtime.state.paths.temp, { recursive: true })
        }
    })
}
