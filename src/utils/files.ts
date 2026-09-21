import fs from 'node:fs'
import path from 'node:path'

// 生成某个群成员的大餐目录路径。
export function buildGuildUserDir(rootPath: string, guildId: string, userId: string) {
    return path.join(rootPath, guildId, userId)
}

// 生成某个群成员的大餐图片路径。
export function buildGuildUserImagePath(rootPath: string, guildId: string, userId: string, filename: string) {
    return path.join(buildGuildUserDir(rootPath, guildId, userId), filename)
}

// 生成临时图片路径。
export function buildTempImagePath(tempPath: string, filename: string) {
    return path.join(tempPath, filename)
}

// 判断路径是否指向文件夹。
export function isDirectory(filePath: string) {
    try {
        return fs.statSync(filePath).isDirectory()
    } catch {
        return false
    }
}

// 列出文件夹里的图片文件，按文件名排序保证顺序稳定。
export function listImageFiles(dirPath: string) {
    const extensions = new Set(['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp'])
    if (!isDirectory(dirPath)) {
        return []
    }
    return fs.readdirSync(dirPath)
        .filter(file => extensions.has(path.extname(file).toLowerCase()))
        .sort()
}

// 复制单个文件或整个文件夹。
export function copyFileOrDirectory(source: string, destination: string) {
    const destDir = path.dirname(destination)
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
    }
    if (isDirectory(source)) {
        fs.mkdirSync(destination, { recursive: true })
        fs.cpSync(source, destination, { recursive: true })
    } else {
        fs.copyFileSync(source, destination)
    }
}

// 删除单个文件或整个文件夹。
export function removeFileOrDirectory(target: string) {
    fs.rmSync(target, { recursive: true, force: true })
}

// 统一根据完整路径判断旧单图/新多图文件夹，并返回实际图片文件列表。
export function getImagePathsFromFullPath(fullPath: string): string[] {
    if (isDirectory(fullPath)) {
        return listImageFiles(fullPath).map(file => path.join(fullPath, file))
    }
    return fs.existsSync(fullPath) ? [fullPath] : []
}

// 获取正式目录里某条记录对应的图片文件路径。
export function getGuildUserImagePaths(rootPath: string, guildId: string, userId: string, pathName: string) {
    return getImagePathsFromFullPath(buildGuildUserImagePath(rootPath, guildId, userId, pathName))
}

// 获取临时目录里某条记录对应的图片文件路径。
export function getTempImagePaths(tempPath: string, pathName: string) {
    return getImagePathsFromFullPath(buildTempImagePath(tempPath, pathName))
}

// 规范化图片文件名：兼容 QQ 图片元数据里类似 `.xxx.jpg` 的写法。
export function normalizeImageFile(file: string) {
    const match = file.match(/\.(.+?\..+?)$/)
    return match ? match[1] : file
}

// 在指定目录下创建唯一文件夹，如果名字冲突则追加 -1、-2。
// 返回创建后的完整路径。
export function createUniqueFolder(basePath: string, preferredName: string) {
    let folderName = preferredName
    let suffix = 1
    while (fs.existsSync(path.join(basePath, folderName))) {
        folderName = `${preferredName}-${suffix++}`
    }
    const fullPath = path.join(basePath, folderName)
    fs.mkdirSync(fullPath, { recursive: true })
    return fullPath
}
