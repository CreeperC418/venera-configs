class TencentComicSource extends ComicSource {
    // 基本信息
    name = "腾讯漫画"
    key = "tencent_comic"
    version = "1.2.1"
    minAppVersion = "1.0.0"
    url = "https://github.com/venera-app/venera-configs"

    init() {
        console.log("腾讯漫画源已初始化")
    }

    // 漫画详情
    comic = {
        loadInfo: async (id) => {
            const url = `https://m.ac.qq.com/comic/index/id/${id}`
            const response = await this.fetchWithRetry(url)
            const html = new HtmlDocument(response.body)
            
            const title = html.querySelector(".head-title-tags h1")?.text.trim() || ""
            const cover = html.querySelector(".head-cover img")?.attributes.src || ""
            const description = html.querySelector(".head-info-desc")?.text.trim() || ""
            const author = html.querySelector(".head-info-author")?.text.replace("作者：", "").trim() || ""
            
            const chapters = {}
            const chapterElements = html.querySelectorAll(".chapter-wrap-list.normal li a")
            chapterElements.forEach((el, index) => {
                const href = el.attributes.href
                const chapterId = href ? href.match(/cid\/(\d+)/)?.[1] || `chapter_${index + 1}` : `chapter_${index + 1}`
                const chapterTitle = el.text.replace(/\s+/g, "").replace(/lock/g, "💲")
                chapters[chapterId] = chapterTitle
            })
            
            return new ComicDetails({
                title: title,
                subtitle: author,
                cover: cover,
                description: description,
                chapters: chapters,
                url: url
            })
        },

        loadEp: async (comicId, epId) => {
            console.log(`加载章节: comicId=${comicId}, epId=${epId}`)
            
            const url = `https://m.ac.qq.com/comic/chapter/id/${comicId}/cid/${epId}`
            const response = await this.fetchWithRetry(url, {
                "Referer": `https://m.ac.qq.com/comic/index/id/${comicId}`
            })
            
            const result = response.body
            
            // 方法1：尝试使用新的API
            try {
                const images = await this.tryApiMethod(comicId, epId)
                if (images.length > 0) return { images: images }
            } catch (e) {
                console.log("API方法失败:", e.message)
            }
            
            // 方法2：尝试多种解密方式
            const images = await this.tryMultipleDecryptMethods(result)
            if (images.length > 0) {
                console.log(`成功获取 ${images.length} 张图片`)
                return { images: images }
            }
            
            // 方法3：尝试直接提取
            const directImages = this.extractDirectImages(result)
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

        idMatch: "https?://m\\.ac\\.qq\\.com/comic/index/id/(\\d+)",
        
        link: {
            domains: ['m.ac.qq.com', 'ac.qq.com'],
            linkToId: (url) => {
                const match = url.match(/comic\/index\/id\/(\d+)/)
                return match ? match[1] : null
            }
        }
    }

    // 搜索配置
    search = {
        load: async (keyword, options, page) => {
            const url = `https://m.ac.qq.com/search/result?word=${encodeURIComponent(keyword)}&page=${page}`
            const response = await this.fetchWithRetry(url)
            const html = new HtmlDocument(response.body)
            const comics = this.parseComicList(html)
            
            return { comics: comics, maxPage: 1 }
        }
    }

    // ========== 辅助方法 ==========

    async tryApiMethod(comicId, epId) {
        // 尝试新的API接口
        const apiUrls = [
            `https://ac.tc.qq.com/store/md/comic/chapterContent?comicId=${comicId}&chapterId=${epId}`,
            `https://m.ac.qq.com/api/chapter/getData?comicId=${comicId}&chapterId=${epId}`,
            `https://ac.qq.com/ComicView/index/id/${comicId}/cid/${epId}`
        ]
        
        for (const apiUrl of apiUrls) {
            try {
                const response = await this.fetchWithRetry(apiUrl, {
                    "Referer": `https://m.ac.qq.com/comic/index/id/${comicId}`,
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36"
                })
                
                const data = JSON.parse(response.body)
                if (data.code === 0 && data.data && data.data.picture) {
                    return data.data.picture.map(item => item.url || "").filter(url => url)
                }
            } catch (e) {
                continue
            }
        }
        
        return []
    }

    async tryMultipleDecryptMethods(html) {
        const decryptionMethods = [
            this.decryptMethod1.bind(this),
            this.decryptMethod2.bind(this),
            this.decryptMethod3.bind(this)
        ]
        
        for (const method of decryptionMethods) {
            try {
                const images = await method(html)
                if (images.length > 0) return images
            } catch (e) {
                console.log(`解密方法失败: ${e.message}`)
            }
        }
        
        return []
    }

    // 方法1：原始解密方法
    async decryptMethod1(html) {
        const dataMatch = html.match(/data:\s*['"](.*?)['"]/)
        const nonceMatch = html.match(/window\.nonce\s*=\s*(['"][^'"]*['"]|[^;]+);/)
        
        if (!dataMatch || !nonceMatch) {
            throw new Error("未找到加密数据")
        }
        
        let data = dataMatch[1]
        let nonce = nonceMatch[1]
        
        // 清理nonce字符串
        nonce = nonce.trim()
        if (nonce.startsWith("'") || nonce.startsWith('"')) {
            nonce = nonce.slice(1, -1)
        }
        
        // 执行nonce代码
        try {
            nonce = eval(nonce)
        } catch (e) {
            // 如果eval失败，尝试直接解析
            const matches = nonce.match(/(\d+\w+)/g)
            if (matches) {
                nonce = matches.join('')
            } else {
                throw new Error("无法解析nonce")
            }
        }
        
        const N = String(nonce).match(/\d+\w+/g)
        if (!N) {
            throw new Error("无法提取解密参数")
        }
        
        // 执行解密
        for (let i = N.length - 1; i >= 0; i--) {
            const current = N[i]
            const numMatch = current.match(/\d+/)
            const strMatch = current.match(/[a-zA-Z]+/)
            
            if (numMatch && strMatch) {
                const position = parseInt(numMatch[0]) % data.length
                const removeStr = strMatch[0]
                
                if (position + removeStr.length <= data.length) {
                    data = data.substring(0, position) + data.substring(position + removeStr.length)
                }
            }
        }
        
        // 解码base64
        try {
            const decoded = Convert.decodeBase64(data)
            const jsonStr = Convert.decodeUtf8(decoded)
            
            // 尝试多种方式匹配图片数据
            const patterns = [
                /"picture":(\[.*?\])/,
                /"content":(\[.*?\])/,
                /"images":(\[.*?\])/
            ]
            
            for (const pattern of patterns) {
                const match = jsonStr.match(pattern)
                if (match) {
                    try {
                        const pictureArray = JSON.parse(match[1])
                        if (Array.isArray(pictureArray)) {
                            return pictureArray.map(item => {
                                if (typeof item === 'string') return item
                                if (item.url) return item.url
                                if (item.img) return item.img
                                return ""
                            }).filter(url => url && url.trim() !== "")
                        }
                    } catch (e) {
                        continue
                    }
                }
            }
        } catch (e) {
            throw new Error("Base64解码失败")
        }
        
        return []
    }

    // 方法2：简化解密方法
    async decryptMethod2(html) {
        // 尝试直接提取加密的JSON数据
        const encryptedPatterns = [
            /window\.DATA\s*=\s*['"]([^'"]+)['"]/,
            /var\s+encryptedData\s*=\s*['"]([^'"]+)['"]/,
            /"encrypted":\s*"([^"]+)"/
        ]
        
        for (const pattern of encryptedPatterns) {
            const match = html.match(pattern)
            if (match && match[1]) {
                try {
                    const decoded = Convert.decodeBase64(match[1])
                    const jsonStr = Convert.decodeUtf8(decoded)
                    
                    // 尝试解析为JSON
                    const jsonData = JSON.parse(jsonStr)
                    if (jsonData && jsonData.picture) {
                        return jsonData.picture.map(item => item.url || "").filter(url => url)
                    }
                } catch (e) {
                    continue
                }
            }
        }
        
        return []
    }

    // 方法3：暴力提取方法
    async decryptMethod3(html) {
        // 尝试提取所有可能的图片URL
        const images = []
        
        // 匹配所有可能的图片URL模式
        const urlPatterns = [
            /"(?:picture|img|image|url)":\s*"([^"]+\.(?:jpg|jpeg|png|webp|gif))"/gi,
            /src="(https?:\/\/[^"]*\.(?:jpg|jpeg|png|webp|gif))"/gi,
            /url\(['"]?([^'"\)]+\.(?:jpg|jpeg|png|webp|gif))['"]?\)/gi
        ]
        
        for (const pattern of urlPatterns) {
            let match
            while ((match = pattern.exec(html)) !== null) {
                if (match[1] && match[1].includes("ac.tc.qq.com")) {
                    images.push(match[1])
                }
            }
        }
        
        return images
    }

    extractDirectImages(html) {
        const images = []
        const doc = new HtmlDocument(html)
        const imgElements = doc.querySelectorAll("img")
        
        imgElements.forEach(img => {
            const src = img.attributes.src
            if (src && (src.includes("ac.tc.qq.com") || src.includes("ac.qq.com"))) {
                images.push(src)
            }
        })
        
        return images
    }

    async fetchWithRetry(url, headers = {}, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const defaultHeaders = {
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
                }
                
                const finalHeaders = Object.assign({}, defaultHeaders, headers)
                return await Network.get(url, finalHeaders)
            } catch (error) {
                if (i === retries - 1) throw error
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
            }
        }
    }

    parseComicList(html) {
        const comics = []
        const selectors = [
            "#lst_searchResult li",
            "#list_update li",
            ".comic-link",
            ".rec-list li",
            ".rank-item",
            ".category-list li"
        ]
        
        for (const selector of selectors) {
            const elements = html.querySelectorAll(selector)
            if (elements.length > 0) {
                elements.forEach(el => {
                    try {
                        const comic = this.parseComicElement(el)
                        if (comic) comics.push(comic)
                    } catch (error) {
                        console.error("解析漫画元素失败:", error)
                    }
                })
                break
            }
        }
        
        return comics
    }

    parseComicElement(element) {
        const linkEl = element.querySelector("a")
        if (!linkEl) return null
        
        const href = linkEl.attributes.href
        const comicId = href ? href.match(/id\/(\d+)/)?.[1] : null
        if (!comicId) return null
        
        const coverEl = element.querySelector("img")
        const cover = coverEl?.attributes.src || ""
        
        const titleEl = element.querySelector(".comic-title") || 
                       element.querySelector(".rec-title") ||
                       element.querySelector(".rank-title") ||
                       element.querySelector("h3") ||
                       element.querySelector("h4")
        const title = titleEl?.text.trim() || ""
        
        const descEl = element.querySelector(".comic-tag") ||
                      element.querySelector(".rec-author") ||
                      element.querySelector(".rank-author")
        const subtitle = descEl?.text.trim() || ""
        
        const updateEl = element.querySelector(".chapter") ||
                        element.querySelector(".comic-update") ||
                        element.querySelector(".rec-update") ||
                        element.querySelector(".rank-update")
        const lastChapter = updateEl?.text.replace("更新", "").trim() || ""
        
        return new Comic({
            id: comicId,
            title: title,
            subtitle: subtitle,
            cover: cover,
            description: lastChapter,
            tags: []
        })
    }
}
