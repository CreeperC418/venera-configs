class TencentComicSource extends ComicSource {
    // 基本信息
    name = "腾讯漫画"
    key = "tencent_comic"
    version = "1.1.0"
    minAppVersion = "1.0.0"
    url = "https://github.com/venera-app/venera-configs"

    // 初始化函数
    init() {
        console.log("腾讯漫画源已初始化");
    }

    // 探索页面配置
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
                ];

                const results = [];
                for (const section of sections) {
                    try {
                        const url = `https://m.ac.qq.com/rank/index?type=${section.param}&pageSize=${section.pageSize}&page=1`;
                        const response = await this.fetchWithRetry(url);
                        const html = new HtmlDocument(response.body);
                        const comics = this.parseRankComics(html);
                        
                        results.push({
                            title: section.title,
                            comics: comics.slice(0, 5), // 只显示前5个
                            viewMore: `https://m.ac.qq.com/rank/index?type=${section.param}&pageSize=${section.pageSize}&page={{page}}`
                        });
                    } catch (error) {
                        console.error(`加载${section.title}失败:`, error);
                    }
                }
                return results;
            }
        },
        {
            title: "热门分类",
            type: "multiPartPage",
            load: async (page) => {
                const categories = [
                    { title: "条漫", param: "tm" },
                    { title: "独家", param: "dj" },
                    { title: "恋爱", param: "na" },
                    { title: "热血", param: "rx" },
                    { title: "悬疑", param: "xy" },
                    { title: "科幻", param: "kh" },
                    { title: "校园", param: "qcxy" },
                    { title: "都市", param: "ds" }
                ];

                const results = [];
                for (const category of categories) {
                    results.push({
                        title: category.title,
                        comics: [],
                        viewMore: `https://m.ac.qq.com/category/listAll?type=${category.param}&rank=pgv&pageSize=20&page={{page}}`
                    });
                }
                return results;
            }
        }
    ]

    // 分类页面配置
    category = {
        title: "分类",
        parts: [
            {
                name: "漫画类型",
                type: "fixed",
                categories: ["条漫", "独家", "完结", "日漫", "恋爱", "玄幻", "热血", "悬疑", "少女", "韩漫", "科幻", "校园", "都市", "治愈", "恐怖", "妖怪", "彩虹", "逗比"],
                categoryParams: ["tm", "dj", "wj", "rm", "na", "xh", "rx", "xy", "sv", "hm", "kh", "qcxy", "ds", "zy", "kb", "yg", "dm", "db"],
                itemType: "category"
            }
        ],
        enableRankingPage: true
    }

    // 分类漫画加载
    categoryComics = {
        load: async (category, param, options, page) => {
            const url = `https://m.ac.qq.com/category/listAll?type=${param}&rank=pgv&pageSize=20&page=${page}`;
            const response = await this.fetchWithRetry(url);
            const html = new HtmlDocument(response.body);
            
            let comics = [];
            const listItems = html.querySelectorAll(".category-list li");
            
            if (listItems.length === 0) {
                // 尝试其他选择器
                comics = this.parseCategoryComics(html);
            } else {
                comics = this.parseListItems(listItems);
            }
            
            // 获取最大页数
            let maxPage = 1;
            const pageLinks = html.querySelectorAll(".ui-pager a");
            for (const link of pageLinks) {
                const text = link.text.trim();
                const num = parseInt(text);
                if (!isNaN(num) && num > maxPage) {
                    maxPage = num;
                }
            }
            
            return { comics: comics, maxPage: maxPage };
        },
        optionList: [],
        ranking: {
            options: ["rise-飙升榜", "pay-畅销榜", "new-新作榜", "hot-真香榜"],
            load: async (option, page) => {
                const url = `https://m.ac.qq.com/rank/index?type=${option}&pageSize=20&page=${page}`;
                const response = await this.fetchWithRetry(url);
                const html = new HtmlDocument(response.body);
                const comics = this.parseRankComics(html);
                
                let maxPage = 1;
                const pageLinks = html.querySelectorAll(".ui-pager a");
                for (const link of pageLinks) {
                    const text = link.text.trim();
                    const num = parseInt(text);
                    if (!isNaN(num) && num > maxPage) {
                        maxPage = num;
                    }
                }
                
                return { comics: comics, maxPage: maxPage };
            }
        }
    }

    // 搜索配置
    search = {
        load: async (keyword, options, page) => {
            const encodedKeyword = encodeURIComponent(keyword);
            const url = `https://m.ac.qq.com/search/result?word=${encodedKeyword}&page=${page}`;
            const response = await this.fetchWithRetry(url);
            const html = new HtmlDocument(response.body);
            
            let comics = [];
            const searchItems = html.querySelectorAll("#lst_searchResult li, .search-result-item");
            
            if (searchItems.length > 0) {
                comics = this.parseSearchItems(searchItems);
            } else {
                // 备用解析
                comics = this.parseSearchComics(html);
            }
            
            // 获取最大页数
            let maxPage = 1;
            const pageInfo = html.querySelector(".ui-pager-info");
            if (pageInfo) {
                const match = pageInfo.text.match(/(\d+)/);
                if (match) {
                    maxPage = parseInt(match[1]);
                }
            }
            
            return { comics: comics, maxPage: maxPage || 1 };
        },
        optionList: [
            {
                type: "select",
                options: ["0-综合排序", "1-人气排序", "2-更新时间"],
                label: "排序方式",
                default: "0"
            }
        ],
        enableTagsSuggestions: false
    }

    // 漫画详情
    comic = {
        loadInfo: async (id) => {
            const url = `https://m.ac.qq.com/comic/index/id/${id}`;
            const response = await this.fetchWithRetry(url);
            const html = new HtmlDocument(response.body);
            
            // 基本信息
            const title = html.querySelector(".head-title-tags h1")?.text.trim() || "未知标题";
            const cover = html.querySelector(".head-cover img")?.attributes.src || "";
            const descElement = html.querySelector(".head-info-desc");
            const description = descElement?.text.trim() || "";
            
            // 作者信息
            const authorElement = html.querySelector(".head-info-author");
            let author = "";
            if (authorElement) {
                author = authorElement.text.trim().replace("作者：", "");
            }
            
            // 标签
            const tags = {};
            const tagElements = html.querySelectorAll(".head-tags span");
            if (tagElements.length > 0) {
                tags["标签"] = tagElements.map(el => el.text.trim()).filter(tag => tag);
            }
            
            // 章节列表
            const chapters = {};
            const chapterElements = html.querySelectorAll(".chapter-wrap-list.normal li a");
            
            chapterElements.forEach((el, index) => {
                const href = el.attributes.href || "";
                const chapterMatch = href.match(/cid\/(\d+)/);
                const chapterId = chapterMatch ? chapterMatch[1] : `chapter_${index + 1}`;
                
                let chapterText = el.text.trim();
                chapterText = chapterText.replace(/\s+/g, " ");
                
                // 清理特殊字符
                chapterText = chapterText.replace(/lock/g, "🔒").replace(/vip/g, "⭐");
                
                chapters[chapterId] = chapterText;
            });
            
            // 如果没有章节，添加一个默认章节
            if (Object.keys(chapters).length === 0) {
                chapters["chapter_1"] = "第一章";
            }
            
            // 推荐漫画
            const recommend = [];
            const recElements = html.querySelectorAll(".rec-list li");
            recElements.forEach(el => {
                const titleEl = el.querySelector(".rec-title");
                const coverEl = el.querySelector("img");
                const linkEl = el.querySelector("a");
                
                if (titleEl && coverEl && linkEl) {
                    const href = linkEl.attributes.href || "";
                    const match = href.match(/id\/(\d+)/);
                    if (match) {
                        recommend.push(new Comic({
                            id: match[1],
                            title: titleEl.text.trim(),
                            cover: coverEl.attributes.src,
                            subtitle: ""
                        }));
                    }
                }
            });
            
            // 更新信息
            const updateElement = html.querySelector(".head-info-update");
            const updateTime = updateElement?.text.trim() || "";
            
            return new ComicDetails({
                title: title,
                subtitle: author,
                cover: cover,
                description: description,
                tags: tags,
                chapters: chapters,
                uploader: author,
                updateTime: updateTime,
                recommend: recommend,
                url: url,
                stars: 0,
                maxPage: Object.keys(chapters).length
            });
        },

        loadEp: async (comicId, epId) => {
            console.log(`加载章节: comicId=${comicId}, epId=${epId}`);
            
            const url = `https://m.ac.qq.com/comic/chapter/id/${comicId}/cid/${epId}`;
            const response = await this.fetchWithRetry(url, {
                "Referer": `https://m.ac.qq.com/comic/index/id/${comicId}`,
                "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36"
            });
            
            const html = response.body;
            
            // 方法1：尝试直接匹配图片数据
            const pictureMatch = html.match(/"picture":(\[.*?\])/);
            if (pictureMatch) {
                try {
                    const pictureData = JSON.parse(pictureMatch[1]);
                    if (Array.isArray(pictureData) && pictureData.length > 0) {
                        const images = pictureData.map(item => item.url || "").filter(url => url);
                        if (images.length > 0) {
                            console.log(`直接匹配到 ${images.length} 张图片`);
                            return { images: images };
                        }
                    }
                } catch (e) {
                    console.log("直接匹配失败，尝试其他方法");
                }
            }
            
            // 方法2：尝试解密逻辑
            const dataMatch = html.match(/data:\s*['"](.*?)['"]/);
            const nonceMatch = html.match(/window\.nonce\s*=\s*(['"][^'"]*['"]|[^;]+);/);
            
            if (dataMatch && nonceMatch) {
                console.log("找到加密数据，尝试解密");
                try {
                    const images = this.decryptImageData(dataMatch[1], nonceMatch[1]);
                    if (images.length > 0) {
                        return { images: images };
                    }
                } catch (e) {
                    console.error("解密失败:", e);
                }
            }
            
            // 方法3：尝试从HTML中提取图片
            console.log("尝试从HTML提取图片");
            const doc = new HtmlDocument(html);
            const imgElements = doc.querySelectorAll("img");
            const images = [];
            
            imgElements.forEach(img => {
                const src = img.attributes.src;
                if (src && src.includes("ac.tc.qq.com")) {
                    images.push(src);
                }
            });
            
            if (images.length > 0) {
                console.log(`从HTML提取到 ${images.length} 张图片`);
                return { images: images };
            }
            
            throw new Error("无法获取漫画图片数据");
        },

        onImageLoad: (url, comicId, epId) => {
            return {
                url: url,
                headers: {
                    "Referer": `https://m.ac.qq.com/comic/chapter/id/${comicId}/cid/${epId}`,
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36"
                }
            };
        },

        idMatch: "id/(\\d+)",
        
        link: {
            domains: ['m.ac.qq.com', 'ac.qq.com'],
            linkToId: (url) => {
                const match = url.match(/comic\/index\/id\/(\d+)/);
                return match ? match[1] : null;
            }
        }
    }

    // ========== 辅助方法 ==========

    // 解密图片数据
    decryptImageData(encryptedData, nonceStr) {
        console.log("开始解密图片数据");
        
        let data = encryptedData;
        let nonce;
        
        // 尝试解析nonce
        try {
            if (nonceStr.includes("'") || nonceStr.includes('"')) {
                nonce = nonceStr.replace(/['"]/g, '');
            } else {
                // 如果nonce是表达式，尝试计算
                nonce = eval(nonceStr);
            }
        } catch (e) {
            console.log("解析nonce失败，尝试其他方法");
            // 尝试直接匹配数字+字母的模式
            const matches = nonceStr.match(/(\d+\w+)/g);
            if (matches && matches.length > 0) {
                nonce = matches.join('');
            } else {
                throw new Error("无法解析nonce");
            }
        }
        
        const N = String(nonce).match(/\d+\w+/g);
        if (!N || N.length === 0) {
            throw new Error("无法提取解密参数");
        }
        
        console.log(`找到 ${N.length} 个解密参数`);
        
        // 执行解密
        for (let i = N.length - 1; i >= 0; i--) {
            const current = N[i];
            const numMatch = current.match(/\d+/);
            const strMatch = current.match(/[a-zA-Z]+/);
            
            if (numMatch && strMatch) {
                const position = parseInt(numMatch[0]) % data.length;
                const removeStr = strMatch[0];
                
                if (position + removeStr.length <= data.length) {
                    data = data.slice(0, position) + data.slice(position + removeStr.length);
                }
            }
        }
        
        // 尝试解码base64
        try {
            const decoded = Convert.decodeBase64(data);
            const jsonStr = Convert.decodeUtf8(decoded);
            
            // 尝试多种方式匹配图片数据
            const patterns = [
                /"picture":(\[.*?\])/,
                /"images":(\[.*?\])/,
                /"url":\s*"([^"]+)"/g
            ];
            
            for (const pattern of patterns) {
                if (pattern.toString().includes('g')) {
                    // 处理多个URL
                    const urls = [];
                    let m;
                    const regex = new RegExp(pattern.source, pattern.flags);
                    while ((m = regex.exec(jsonStr)) !== null) {
                        urls.push(m[1]);
                    }
                    if (urls.length > 0) {
                        console.log(`解密成功，找到 ${urls.length} 张图片`);
                        return urls;
                    }
                } else {
                    // 处理JSON数组
                    const match = jsonStr.match(pattern);
                    if (match) {
                        try {
                            const pictureArray = JSON.parse(match[1]);
                            if (Array.isArray(pictureArray)) {
                                const images = pictureArray.map(item => {
                                    return typeof item === 'string' ? item : (item.url || "");
                                }).filter(url => url && url.trim() !== "");
                                if (images.length > 0) {
                                    console.log(`解密成功，找到 ${images.length} 张图片`);
                                    return images;
                                }
                            }
                        } catch (e) {
                            console.log(`模式匹配但解析失败: ${e}`);
                        }
                    }
                }
            }
        } catch (e) {
            console.error("base64解码失败:", e);
        }
        
        throw new Error("解密后无法提取图片URL");
    }

    // 带重试的请求
    async fetchWithRetry(url, headers = {}, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const defaultHeaders = {
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Connection": "keep-alive"
                };
                
                const finalHeaders = Object.assign({}, defaultHeaders, headers);
                return await Network.get(url, finalHeaders);
            } catch (error) {
                if (i === retries - 1) throw error;
                console.log(`请求失败，第${i + 1}次重试: ${url}`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    // 解析排行榜漫画
    parseRankComics(html) {
        const comics = [];
        const items = html.querySelectorAll(".rank-item, .rank-list li");
        
        items.forEach(item => {
            const link = item.querySelector("a");
            if (!link) return;
            
            const href = link.attributes.href || "";
            const match = href.match(/id\/(\d+)/);
            if (!match) return;
            
            const cover = item.querySelector("img")?.attributes.src || "";
            const title = item.querySelector(".rank-title, .title")?.text.trim() || "";
            const author = item.querySelector(".rank-author, .author")?.text.trim() || "";
            
            comics.push(new Comic({
                id: match[1],
                title: title,
                subtitle: author,
                cover: cover,
                description: ""
            }));
        });
        
        return comics;
    }

    // 解析分类漫画
    parseCategoryComics(html) {
        const comics = [];
        const items = html.querySelectorAll(".comic-link, .category-item, li");
        
        items.forEach(item => {
            const link = item.querySelector("a");
            if (!link) return;
            
            const href = link.attributes.href || "";
            const match = href.match(/id\/(\d+)/);
            if (!match) return;
            
            const cover = item.querySelector("img")?.attributes.src || "";
            const title = item.querySelector(".comic-title, .title, h3, h4")?.text.trim() || "";
            const update = item.querySelector(".chapter, .update, .comic-update")?.text.trim() || "";
            
            comics.push(new Comic({
                id: match[1],
                title: title,
                subtitle: update,
                cover: cover,
                description: ""
            }));
        });
        
        return comics;
    }

    // 解析搜索项目
    parseSearchItems(items) {
        const comics = [];
        
        items.forEach(item => {
            const link = item.querySelector("a");
            if (!link) return;
            
            const href = link.attributes.href || "";
            const match = href.match(/id\/(\d+)/);
            if (!match) return;
            
            const cover = item.querySelector("img")?.attributes.src || "";
            const title = item.querySelector(".comic-title, .search-title")?.text.trim() || "";
            const author = item.querySelector(".comic-author, .author")?.text.trim() || "";
            const update = item.querySelector(".comic-update, .update")?.text.trim() || "";
            
            comics.push(new Comic({
                id: match[1],
                title: title,
                subtitle: author ? `${author} | ${update}` : update,
                cover: cover,
                description: update
            }));
        });
        
        return comics;
    }

    // 解析列表项
    parseListItems(items) {
        const comics = [];
        
        items.forEach(item => {
            const link = item.querySelector("a");
            if (!link) return;
            
            const href = link.attributes.href || "";
            const match = href.match(/id\/(\d+)/);
            if (!match) return;
            
            const cover = item.querySelector("img")?.attributes.src || "";
            const titleElement = item.querySelector(".comic-title, h3, h4");
            const title = titleElement?.text.trim() || link.text.trim() || "";
            
            const descElement = item.querySelector(".comic-desc, .desc");
            const updateElement = item.querySelector(".comic-update, .update");
            
            let subtitle = "";
            if (descElement) subtitle = descElement.text.trim();
            if (updateElement && !subtitle.includes(updateElement.text.trim())) {
                subtitle += (subtitle ? " | " : "") + updateElement.text.trim();
            }
            
            comics.push(new Comic({
                id: match[1],
                title: title,
                subtitle: subtitle,
                cover: cover,
                description: subtitle
            }));
        });
        
        return comics;
    }

    // 解析搜索漫画
    parseSearchComics(html) {
        const comics = [];
        const links = html.querySelectorAll("a[href*='/comic/index/id/']");
        
        links.forEach(link => {
            const href = link.attributes.href || "";
            const match = href.match(/id\/(\d+)/);
            if (!match) return;
            
            // 向上查找可能的封面和标题
            const container = link.parentElement;
            const img = container?.querySelector("img");
            const cover = img?.attributes.src || "";
            
            const title = link.text.trim() || "";
            if (!title) return;
            
            comics.push(new Comic({
                id: match[1],
                title: title,
                subtitle: "",
                cover: cover,
                description: ""
            }));
        });
        
        return comics;
    }

    // 设置项
    settings = {
        requestTimeout: {
            title: "请求超时时间(秒)",
            type: "input",
            validator: "^[0-9]+$",
            default: "10",
            description: "设置网络请求超时时间"
        },
        imageRetryCount: {
            title: "图片重试次数",
            type: "input",
            validator: "^[0-9]+$",
            default: "3",
            description: "图片加载失败时的重试次数"
        }
    }

    // 翻译
    translation = {
        'zh_CN': {
            '腾讯漫画': '腾讯漫画',
            '请求超时时间(秒)': '请求超时时间(秒)',
            '图片重试次数': '图片重试次数',
            '设置网络请求超时时间': '设置网络请求超时时间',
            '图片加载失败时的重试次数': '图片加载失败时的重试次数'
        }
    }
}

// 注册源
ComicSource.sources.tencent_comic = new TencentComicSource();
