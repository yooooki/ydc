import fs from 'node:fs'
import path from 'node:path'
import { Context, h } from 'koishi'

import type { DCTable } from '../database'
import type { RecordImageMode } from '../config'
import type { RuntimeContext } from '../runtime'

import { ensureSession } from '../utils/argv'
import {
    buildGuildUserImagePath,
    buildTempImagePath,
    createUniqueFolder,
    getGuildUserImagePaths,
    getTempImagePaths,
    normalizeImageFile,
    removeFileOrDirectory,
} from '../utils/files'
import { formatTimestampFolderName } from '../utils/time'
import { extractImageSources, extractSingleAtId, type ImageSource } from '../utils/message'
import { filePathsToImageElements } from '../utils/image'
import { getGuildLock, setGuildLock } from '../runtime'

// 获取被引用消息的 ID，兼容不同适配器对 id / messageId 的命名差异。
function getMessageId(target: { id?: string, messageId?: string }) {
    return target.id ?? target.messageId
}

// 在两张记录表里同时查找可能重复的旧记录。
async function findDuplicateRecords(
    database: Context['database'],
    table: 'dc_table' | 'pending_dc_table',
    firstImage: ImageSource,
    lastImage: ImageSource,
    messageId: string | undefined,
    dinerId: string,
): Promise<DCTable[]> {
    const conditions: Record<string, unknown>[] = []
    if (firstImage.src) {
        conditions.push({ url: firstImage.src, user: dinerId })
    }
    if (lastImage.src && lastImage.src !== firstImage.src) {
        conditions.push({ url: lastImage.src, user: dinerId })
    }
    if (messageId) {
        conditions.push({ messageId })
    }
    if (!conditions.length) return []
    return database.get(table, { $or: conditions })
}

// 判断旧记录是否与当前 recordImageMode 匹配。
function isMatchingRecord(
    record: DCTable,
    mode: RecordImageMode,
    firstImage: ImageSource,
    lastImage: ImageSource,
    messageId: string | undefined,
) {
    if (mode === 'all') {
        return !!messageId && record.messageId === messageId
    }
    // 带 messageId 的记录一定是 all 模式，单图模式遇到它时不匹配。
    if (record.messageId) {
        return false
    }
    const selectedUrl = mode === 'first' ? firstImage.src : lastImage.src
    return record.url === selectedUrl
}

// 下载远程图片到本地 buffer。
async function downloadImage(url: string) {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`下载图片失败: ${response.status} ${response.statusText}`)
    }
    return Buffer.from(await response.arrayBuffer())
}

// 根据图片 file 信息推测扩展名，失败时用 .jpg。
function getImageExtension(file: string) {
    const ext = path.extname(file).toLowerCase()
    return ext || '.jpg'
}

// 记录一条新的大餐待审核记录。
export function registerYdcCommand(ctx: Context, runtime: RuntimeContext) {
    const cfg = runtime.config
    const rootPath = runtime.state.paths.root
    const tempPath = runtime.state.paths.temp
    const recordMode = cfg.recordImageMode ?? 'last'

    ctx.command('ydc [arg0:string]', '记录群友大餐瞬间')
        .alias('ydc?')
        .usage('回复一个包含大餐图片的发言，ydc \n如果这张图不是大餐人发的，可以在后面加上对大餐人的at')
        .action(async (argv, arg0) => {
            const session = ensureSession(argv)
            const guildId = session.guildId
            if (guildId == null) {
                return '只能在群聊中使用'
            }
            const target = session.quote
            if (target == null) {
                return '你必须引用一条大餐'
            }
            const targetUser = target.user
            if (targetUser == null) {
                return '你必须引用一条大餐'
            }

            let dinerId = targetUser.id
            if (arg0) {
                const atId = extractSingleAtId(arg0)
                if (atId) {
                    dinerId = atId
                }
            }

            // 提取被引用消息里的所有图片
            const images = extractImageSources(target.content ?? '')
            if (images.length === 0) {
                return '引用的大餐消息必须包含一张大餐图片'
            }
            const firstImage = images[0]
            const lastImage = images[images.length - 1]
            const messageId = getMessageId(target)
            if (recordMode === 'all' && !messageId) {
                return '无法获取被引用消息的 ID，不能以 all 模式记录全部图片'
            }

            if (getGuildLock(runtime.state.locks.ydc, guildId)) {
                return '正在添加大餐记录...， 请重试'
            }

            const stamp = session.event.timestamp
            const folderName = formatTimestampFolderName(stamp)

            setGuildLock(runtime.state.locks.ydc, guildId, true)
            void (async () => {
                try {
                    const [dcRecords, pendingRecords] = await Promise.all([
                        findDuplicateRecords(ctx.database, 'dc_table', firstImage, lastImage, messageId, dinerId),
                        findDuplicateRecords(ctx.database, 'pending_dc_table', firstImage, lastImage, messageId, dinerId),
                    ])

                    const matchedDc = dcRecords.find(record => isMatchingRecord(record, recordMode, firstImage, lastImage, messageId))
                    const matchedPending = pendingRecords.find(record => isMatchingRecord(record, recordMode, firstImage, lastImage, messageId))
                    // 旧记录与当前记录方式一致：直接提示重复，不再重复写入。
                    if (matchedDc) {
                        const imageElements = await filePathsToImageElements(
                            getGuildUserImagePaths(rootPath, matchedDc.channelId, matchedDc.user, matchedDc.path),
                            cfg.smallReply,
                        )
                        await session.send(h('p', h.at(dinerId), '的这次大餐早就被记录了！'))
                        return
                    }
                    if (matchedPending) {
                        const imageElements = await filePathsToImageElements(
                            getTempImagePaths(tempPath, matchedPending.path),
                            cfg.smallReply,
                        )
                        await session.send(h('p', h.at(dinerId), '的这次大餐早就被记录到待审核了！'))
                        return
                    }

                    let imageElements: ReturnType<typeof h.image>[]
                    if (recordMode === 'all') {
                        // all 模式：下载全部图片到按时间命名的临时文件夹。
                        const tempFolder = createUniqueFolder(tempPath, folderName)
                        const buffers = await Promise.all(images.map(image => downloadImage(image.src)))
                        buffers.forEach((buffer, index) => {
                            fs.writeFileSync(path.join(tempFolder, `${index}${getImageExtension(images[index].file)}`), buffer)
                        })

                        await ctx.database.create('pending_dc_table', {
                            channelId: guildId,
                            user: dinerId,
                            stamp: new Date(stamp),
                            path: path.basename(tempFolder),
                            messageId,
                        })

                        imageElements = cfg.smallReply
                            ? await filePathsToImageElements(getTempImagePaths(tempPath, path.basename(tempFolder)), true)
                            : images.map(image => h.image(image.src))
                    } else {
                        // first / last 模式：只保存选择的那一张图片。
                        const selectedImage = recordMode === 'first' ? firstImage : lastImage
                        const file = normalizeImageFile(selectedImage.file)
                        const buffer = await downloadImage(selectedImage.src)
                        fs.writeFileSync(buildTempImagePath(tempPath, file), buffer)

                        await ctx.database.create('pending_dc_table', {
                            channelId: guildId,
                            user: dinerId,
                            url: selectedImage.src,
                            stamp: new Date(stamp),
                            path: file,
                        })

                        imageElements = cfg.smallReply
                            ? await filePathsToImageElements(getTempImagePaths(tempPath, file), true)
                            : [h.image(selectedImage.src)]
                    }

                    // 新记录创建成功后再删除不匹配的旧记录，避免新记录失败时旧数据丢失。
                    for (const record of dcRecords) {
                        await ctx.database.remove('dc_table', { id: record.id })
                        try {
                            removeFileOrDirectory(buildGuildUserImagePath(rootPath, record.channelId, record.user, record.path))
                        } catch {
                            // 旧文件清理失败不阻塞重录流程
                        }
                    }
                    for (const record of pendingRecords) {
                        await ctx.database.remove('pending_dc_table', { id: record.id })
                        try {
                            removeFileOrDirectory(buildTempImagePath(tempPath, record.path))
                        } catch {
                            // 旧文件清理失败不阻塞重录流程
                        }
                    }

                    await session.send(h('p', h.at(dinerId), '的大餐', ...imageElements, '已经被添加到待审核'))
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    await session.send(`大餐记录添加失败：异常: ${message}`)
                } finally {
                    setGuildLock(runtime.state.locks.ydc, guildId, false)
                }
            })()
        })
}
