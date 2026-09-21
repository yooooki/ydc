import { h } from 'koishi'

// 消息里的一张图片。
export interface ImageSource {
    src: string
    file: string
}

// 只接受单独存在的一段 @ 提及。
export function extractSingleAtId(input: string) {
    const elements = h.parse(input)
    if (elements.length !== 1 || elements[0].type !== 'at') {
        return
    }
    const id = elements[0].attrs.id
    if (typeof id !== 'string') {
        return
    }
    return id
}

// 按出现顺序提取消息里的所有图片。
export function extractImageSources(content: string): ImageSource[] {
    const images: ImageSource[] = []
    for (const element of h.parse(content)) {
        if (element.type !== 'img') {
            continue
        }
        const src = element.attrs.src
        const file = element.attrs.file
        if (typeof src !== 'string' || typeof file !== 'string') {
            continue
        }
        images.push({ src, file })
    }
    return images
}

// 如果存在多张图片，则返回最后一张；没有图片时返回 undefined。
export function extractLastImageSource(content: string) {
    const images = extractImageSources(content)
    return images[images.length - 1]
}
