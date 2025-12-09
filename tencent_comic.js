class TencentComicSource extends ComicSource {
    // 基本信息
    name = "腾讯漫画"
    key = "tencent_comic"
    version = "1.2.0"
    minAppVersion = "1.0.0"
    url = "https://github.com/venera-app/venera-configs"

    init() {
        console.log("腾讯漫画源已初始化")
    }

    explore = [
        {
            title: "排行榜",
            type: "multiPartPage",
            load: async (page) => {
                const sections = [
                    { title: "飙升榜", param: "rise", pageSize: 10 },
                    { title: "畅销榜", param: "pay", pageSize: 10 },
                    { title: "新作榜", param: "new", pageSize: 10 },
                    { title: "真香榜", param: "hot", pageSize: 10 }
                ]
                const results = []
                for (const section of sections) {
                    try {
                        const url = `https://m.ac.qq.com/rank/index?type=${section.param}&pageSize=${section.pageSize}&page=1`
                        const response = await this.fetchWithRetry(url)
                        const html = new HtmlDocument(response.body)
                        const comics = this.parseRankComics(html)
                        results.push({
                            title: section.title,
                            comics: comics.slice(0, 5),
                            viewMore: `https://m.ac.qq.com/rank/index?type=${section.param}&pageSize=${section.pageSize}&page={{page}}`
                        })
                    } catch (error) {
                        console.error(`加载${section.title}失败:`, error)
                    }
                }
                return results
            }
        }
    ]

    comic = {
        loadInfo: async (id) => {
            const url = `https://m.ac.qq.com/comic/index/id/${id}`
            const response = await this.fetchWithRetry(url)
            const html = new HtmlDocument(response.body)
            
            const title = html.querySelector(".head-title-tags h1")?.text.trim() || "未知标题"
            const cover = html.querySelector(".head-cover img")?.attributes.src || ""
            const author = html.querySelector(".head-info-author")?.text.trim().replace("作者：", "") || ""
            
            const chapters = {}
            const chapterElements = html.querySelectorAll(".chapter-wrap-list.normal li a")
            chapterElements.forEach((el, index) => {
                const href = el.attributes.href || ""
                const match = href.match(/cid\/(\d+)/)
                const chapterId = match ? match[1] : `chapter_${index + 1}`
                let chapterText = el.text.trim().replace(/\s+/g, " ").replace(/lock/g, "🔒")
                chapters[chapterId] = chapterText
            })
            
            if (Object.keys(chapters).length === 0) {
                chapters["chapter_1"] = "第一章"
            }
            
            return new ComicDetails({
                title: title,
                subtitle: author,
                cover: cover,
                chapters: chapters,
                url: url
            })
        },

        loadEp: async (comicId, epId) => {
            console.log(`加载章节: comicId=${comicId}, epId=${epId}`)
            
            // 方法1：尝试使用移动端API
            try {
                const apiUrl = `https://m.ac.qq.com/chapter/getData?comicId=${comicId}&chapterId=${epId}`
                const apiResponse = await this.fetchWithRetry(apiUrl, {
                    "Referer": `https://m.ac.qq.com/comic/index/id/${comicId}`,
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36"
                })
                
                const apiData = JSON.parse(apiResponse.body)
                if (apiData.code === 0 && apiData.data && apiData.data.picture) {
                    const images = apiData.data.picture.map(item => item.url || "").filter(url => url)
                    if (images.length > 0) {
                        console.log(`API获取到 ${images.length} 张图片`)
                        return { images: images }
                    }
                }
            } catch (e) {
                console.log("API方式失败:", e.message)
            }
            
            // 方法2：传统解密方法
            const url = `https://m.ac.qq.com/comic/chapter/id/${comicId}/cid/${epId}`
            const response = await this.fetchWithRetry(url, {
                "Referer": `https://m.ac.qq.com/comic/index/id/${comicId}`,
                "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36"
            })
            
            const html = response.body
            
            // 尝试提取加密数据
            const encryptedData = this.extractEncryptedData(html)
            if (encryptedData) {
                try {
                    const images = this.decryptComicData(encryptedData)
                    if (images.length > 0) {
                        return { images: images }
                    }
                } catch (e) {
                    console.log("解密失败:", e.message)
                }
            }
            
            // 方法3：尝试直接匹配图片URL
            const directImages = this.extractDirectImages(html)
            if (directImages.length > 0) {
                console.log(`直接提取到 ${directImages.length} 张图片`)
                return { images: directImages }
            }
            
            throw new Error("无法获取漫画图片数据")
        },

        onImageLoad: (url, comicId, epId) => {
            return {
                url: url,
                headers: {
                    "Referer": `https://m.ac.qq.com/comic/chapter/id/${comicId}/cid/${epId}`,
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36"
                }
            }
        },

        idMatch: "id/(\\d+)",
        
        link: {
            domains: ['m.ac.qq.com', 'ac.qq.com'],
            linkToId: (url) => {
                const match = url.match(/comic\/index\/id\/(\d+)/)
                return match ? match[1] : null
            }
        }
    }

    // ========== 辅助方法 ==========

    extractEncryptedData(html) {
        // 尝试多种方式提取加密数据
        const patterns = [
            /data:\s*['"]([^'"]+)['"]/,
            /window\.DATA\s*=\s*['"]([^'"]+)['"]/,
            /var\s+data\s*=\s*['"]([^'"]+)['"]/,
            /"data":\s*"([^"]+)"/,
            /encryptedData:\s*"([^"]+)"/
        ]
        
        for (const pattern of patterns) {
            const match = html.match(pattern)
            if (match && match[1]) {
                return match[1]
            }
        }
        
        return null
    }

    extractDirectImages(html) {
        const images = []
        
        // 尝试提取图片URL
        const imgPatterns = [
            /"picture":\s*(\[.*?\])/,
            /"images":\s*(\[.*?\])/,
            /"url":\s*"([^"]+)"/g,
            /src="(https?:\/\/[^"]*\.(?:jpg|jpeg|png|webp|gif))"/gi
        ]
        
        for (const pattern of imgPatterns) {
            if (pattern.flags && pattern.flags.includes('g')) {
                let match
                while ((match = pattern.exec(html)) !== null) {
                    if (match[1]) images.push(match[1])
                }
            } else {
                const match = html.match(pattern)
                if (match && match[1]) {
                    try {
                        const data = JSON.parse(match[1])
                        if (Array.isArray(data)) {
                            data.forEach(item => {
                                const url = typeof item === 'string' ? item : (item.url || "")
                                if (url) images.push(url)
                            })
                        }
                    } catch (e) {
                        // 如果不是JSON，直接添加
                        images.push(match[1])
                    }
                }
            }
        }
        
        return images.filter(url => url.includes("ac.tc.qq.com") || url.includes("ac.qq.com"))
    }

    decryptComicData(encryptedData) {
        console.log("开始解密漫画数据")
        
        let data = encryptedData
        
        // 腾讯漫画的解密通常涉及移除特定位置的字符
        // 尝试常见的解密模式
        const decryptionPatterns = [
            // 模式1：移除每第N个字符
            (str) => {
                const result = []
                for (let i = 0; i < str.length; i++) {
                    if ((i + 1) % 3 !== 0) { // 移除每第3个字符
                        result.push(str[i])
                    }
                }
                return result.join('')
            },
            // 模式2：反转字符串
            (str) => str.split('').reverse().join(''),
            // 模式3：移除特定字符
            (str) => str.replace(/[^A-Za-z0-9+/=]/g, '')
        ]
        
        for (const pattern of decryptionPatterns) {
            try {
                const decrypted = pattern(data)
                const decoded = Convert.decodeBase64(decrypted)
                const jsonStr = Convert.decodeUtf8(decoded)
                
                // 尝试解析为JSON
                const jsonData = JSON.parse(jsonStr)
                if (jsonData && jsonData.picture) {
                    const images = jsonData.picture.map(item => item.url || "").filter(url => url)
                    if (images.length > 0) {
                        console.log(`解密成功，找到 ${images.length} 张图片`)
                        return images
                    }
                }
            } catch (e) {
                continue
            }
        }
        
        // 如果上述方法都失败，尝试简单的base64解码
        try {
            const decoded = Convert.decodeBase64(data)
            const jsonStr = Convert.decodeUtf8(decoded)
            
            // 尝试提取图片URL
            const urlMatches = jsonStr.match(/"url":\s*"([^"]+)"/g)
            if (urlMatches) {
                const images = urlMatches.map(match => {
                    const urlMatch = match.match(/"url":\s*"([^"]+)"/)
                    return urlMatch ? urlMatch[1] : ""
                }).filter(url => url)
                
                if (images.length > 0) {
                    console.log(`直接提取到 ${images.length} 张图片`)
                    return images
                }
            }
        } catch (e) {
            console.log("Base64解码失败:", e.message)
        }
        
        throw new Error("解密失败")
    }

    async fetchWithRetry(url, headers = {}, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const defaultHeaders = {
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Connection": "keep-alive"
                }
                
                const finalHeaders = Object.assign({}, defaultHeaders, headers)
                return await Network.get(url, finalHeaders)
            } catch (error) {
                if (i === retries - 1) throw error
                console.log(`请求失败，第${i + 1}次重试: ${url}`)
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
            }
        }
    }

    parseRankComics(html) {
        const comics = []
        const items = html.querySelectorAll(".rank-item, .rank-list li")
        
        items.forEach(item => {
            const link = item.querySelector("a")
            if (!link) return
            
            const href = link.attributes.href || ""
            const match = href.match(/id\/(\d+)/)
            if (!match) return
            
            const cover = item.querySelector("img")?.attributes.src || ""
            const title = item.querySelector(".rank-title, .title")?.text.trim() || ""
            
            comics.push(new Comic({
                id: match[1],
                title: title,
                cover: cover
            }))
        })
        
        return comics
    }

    search = {
        load: async (keyword, options, page) => {
            const encodedKeyword = encodeURIComponent(keyword)
            const url = `https://m.ac.qq.com/search/result?word=${encodedKeyword}&page=${page}`
            const response = await this.fetchWithRetry(url)
            const html = new HtmlDocument(response.body)
            
            const comics = []
            const items = html.querySelectorAll("#lst_searchResult li, .search-result-item, .comic-link")
            
            items.forEach(item => {
                const link = item.querySelector("a")
                if (!link) return
                
                const href = link.attributes.href || ""
                const match = href.match(/id\/(\d+)/)
                if (!match) return
                
                const cover = item.querySelector("img")?.attributes.src || ""
                const title = item.querySelector(".comic-title, .search-title, h3")?.text.trim() || ""
                
                comics.push(new Comic({
                    id: match[1],
                    title: title,
                    cover: cover
                }))
            })
            
            return { comics: comics, maxPage: 1 }
        }
    }
}
