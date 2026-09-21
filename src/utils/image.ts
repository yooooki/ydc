import { h } from 'koishi'
import sharp from 'sharp'

// 把图片文件统一转为 h.image 元素；small 为 true 时缩小为 200px 宽。
// 多张图片会作为数组返回，调用方应把它们放在同一条消息里发送。
export async function filePathsToImageElements(filePaths: string[], small: boolean) {
    return Promise.all(filePaths.map(async (filePath) => {
        const pipeline = sharp(filePath)
        const buffer = small
            ? await pipeline.resize(200).jpeg().toBuffer()
            : await pipeline.jpeg().toBuffer()
        return h.image(buffer, 'image/jpeg')
    }))
}
