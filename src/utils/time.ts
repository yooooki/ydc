// 所有和时间格式化、日期解析相关的工具函数集中放在这里。

// 将消息时间格式化为 YYYYMMDD-HHmmss，用作 all 模式的图片文件夹名。
export function formatTimestampFolderName(stamp: number | Date) {
    const date = new Date(stamp)
    const pad = (value: number) => String(value).padStart(2, '0')
    const datePart = [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
    ].join('')
    const timePart = [
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds()),
    ].join('')
    return `${datePart}-${timePart}`
}

export interface DateRange {
    start: Date
    end: Date
}

// 解析日期范围参数，支持：
//   -d 2026-04-01
//   -d 2026-04-01~2026-04-10
// 不传结束日期时默认查询起始日期当天。
export function parseDateRange(input: string): DateRange | null {
    const value = input.trim()
    if (!value) return null
    const [rawStart, rawEnd] = value.split('~')
    const start = new Date(Date.parse(rawStart))
    if (Number.isNaN(start.getTime())) return null

    const oneDay = 24 * 60 * 60 * 1000
    let end = new Date(start.getTime() + oneDay)
    if (rawEnd) {
        const parsedEnd = new Date(Date.parse(rawEnd))
        if (!Number.isNaN(parsedEnd.getTime()) && parsedEnd > start) {
            end = parsedEnd
        }
    }
    return { start, end }
}

// 统一的日期显示格式，例如：2026年4月14日。
export function formatDate(date: Date) {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }
    return date.toLocaleDateString('zh-CN', options)
}
