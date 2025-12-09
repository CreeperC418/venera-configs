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
                const match = jsonStr.match(pattern);
                if (match) {
                    try {
                        if (pattern.toString().includes('g')) {
                            // 处理多个URL
                            const urls = [];
                            let m;
                            while ((m = pattern.exec(jsonStr)) !== null) {
                                urls.push(m[1]);
                            }
                            if (urls.length > 0) {
                                console.log(`解密成功，找到 ${urls.length} 张图片`);
                                return urls;
                            }
                        } else {
                            // 处理JSON数组
                            const pictureArray = JSON.parse(match[1]);
                            if (Array.isArray(pictureArray)) {
                                const images = pictureArray.map(item => {
                                    return typeof item === 'string' ? item : item.url;
                                }).filter(url => url);
                                console.log(`解密成功，找到 ${images.length} 张图片`);
                                return images;
                            }
                        }
                    } catch (e) {
                        console.log(`模式 ${pattern} 匹配但解析失败`);
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
                
                const finalHeaders = { ...defaultHeaders, ...headers };
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
ComicSource.sources.tencent_comic = new TencentComicSource();                ];

                const results = [];
                for (const section of sections) {
                    try {
                        const response = await Network.get(section.url, {});
                        const html = new HtmlDocument(response.body);
                        const comics = this.parseComicList(html);
                        results.push({
                            title: section.title,
                            comics: comics,
                            viewMore: section.url.replace("page=1", "page={{page}}")
                        });
                    } catch (error) {
                        console.error(`加载${section.title}失败:`, error);
                    }
                }
                return results;
            }
        },
        {
            title: "分类浏览",
            type: "multiPartPage",
            load: async (page) => {
                const categories = [
                    { title: "条漫", param: "tm" },
                    { title: "独家", param: "dj" },
                    { title: "完结", param: "wj" },
                    { title: "日漫", param: "rm" },
                    { title: "恐怖", param: "kb" },
                    { title: "妖怪", param: "yg" },
                    { title: "恋爱", param: "na" },
                    { title: "玄幻", param: "xh" },
                    { title: "热血", param: "rx" },
                    { title: "悬疑", param: "xy" },
                    { title: "彩虹", param: "dm" },
                    { title: "少女", param: "sv" },
                    { title: "韩漫", param: "hm" },
                    { title: "科幻", param: "kh" },
                    { title: "逗比", param: "db" },
                    { title: "校园", param: "qcxy" },
                    { title: "都市", param: "ds" },
                    { title: "治愈", param: "zy" }
                ];

                const results = [];
                for (const category of categories) {
                    results.push({
                        title: category.title,
                        comics: [],
                        viewMore: `https://m.ac.qq.com/category/listAll?type=${category.param}&rank=pgv&pageSize=30&page={{page}}`
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
                categories: ["条漫", "独家", "完结", "日漫", "恐怖", "妖怪", "恋爱", "玄幻", "热血", "悬疑", "彩虹", "少女", "韩漫", "科幻", "逗比", "校园", "都市", "治愈"],
                categoryParams: ["tm", "dj", "wj", "rm", "kb", "yg", "na", "xh", "rx", "xy", "dm", "sv", "hm", "kh", "db", "qcxy", "ds", "zy"],
                itemType: "category"
            }
        ],
        enableRankingPage: true
    }

    // 分类漫画加载
    categoryComics = {
        load: async (category, param, options, page) => {
            let url;
            if (param) {
                url = `https://m.ac.qq.com/category/listAll?type=${param}&rank=pgv&pageSize=30&page=${page}`;
            } else {
                url = `https://m.ac.qq.com/category/listAll?rank=pgv&pageSize=30&page=${page}`;
            }
            
            const response = await Network.get(url, {});
            const html = new HtmlDocument(response.body);
            const comics = this.parseComicList(html);
            
            // 尝试获取最大页数
            let maxPage = 1;
            const pageElements = html.querySelectorAll(".ui-pager-page");
            if (pageElements.length > 0) {
                const lastPage = pageElements[pageElements.length - 1];
                const pageText = lastPage.text.trim();
                const pageNum = parseInt(pageText);
                if (!isNaN(pageNum)) {
                    maxPage = pageNum;
                }
            }
            
            return {
                comics: comics,
                maxPage: maxPage
            };
        },
        optionList: [],
        ranking: {
            options: [
                "rise-飙升榜",
                "pay-畅销榜",
                "new-新作榜",
                "hot-真香榜"
            ],
            load: async (option, page) => {
                const url = `https://m.ac.qq.com/rank/index?type=${option}&pageSize=30&page=${page}`;
                const response = await Network.get(url, {});
                const html = new HtmlDocument(response.body);
                const comics = this.parseComicList(html);
                
                let maxPage = 1;
                const pageElements = html.querySelectorAll(".ui-pager-page");
                if (pageElements.length > 0) {
                    const lastPage = pageElements[pageElements.length - 1];
                    const pageText = lastPage.text.trim();
                    const pageNum = parseInt(pageText);
                    if (!isNaN(pageNum)) {
                        maxPage = pageNum;
                    }
                }
                
                return {
                    comics: comics,
                    maxPage: maxPage
                };
            }
        }
    }

    // 搜索配置
    search = {
        load: async (keyword, options, page) => {
            const url = `https://m.ac.qq.com/search/result?word=${encodeURIComponent(keyword)}&page=${page}`;
            const response = await Network.get(url, {});
            const html = new HtmlDocument(response.body);
            const comics = this.parseComicList(html);
            
            let maxPage = 1;
            const pageElements = html.querySelectorAll(".ui-pager-page");
            if (pageElements.length > 0) {
                const lastPage = pageElements[pageElements.length - 1];
                const pageText = lastPage.text.trim();
                const pageNum = parseInt(pageText);
                if (!isNaN(pageNum)) {
                    maxPage = pageNum;
                }
            }
            
            return {
                comics: comics,
                maxPage: maxPage
            };
        },
        optionList: [
            {
                type: "select",
                options: [
                    "0-综合排序",
                    "1-人气排序",
                    "2-更新时间"
                ],
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
            const response = await Network.get(url, {});
            const html = new HtmlDocument(response.body);
            
            // 解析基本信息
            const title = html.querySelector(".head-title-tags h1")?.text.trim() || "";
            const cover = html.querySelector(".head-cover img")?.attributes.src || "";
            const description = html.querySelector(".head-info-desc")?.text.trim() || "";
            const author = html.querySelector(".head-info-author")?.text.replace("作者：", "").trim() || "";
            const updateTime = html.querySelector(".head-info-update")?.text.trim() || "";
            
            // 解析标签
            const tags = {};
            const tagElements = html.querySelectorAll(".head-tags span");
            if (tagElements.length > 0) {
                tags["分类"] = tagElements.map(el => el.text.trim());
            }
            
            // 解析章节列表
            const chapters = {};
            const chapterElements = html.querySelectorAll(".chapter-wrap-list.normal li a");
            chapterElements.forEach((el, index) => {
                const href = el.attributes.href;
                const chapterId = href ? href.match(/cid\/(\d+)/)?.[1] || `chapter_${index + 1}` : `chapter_${index + 1}`;
                const chapterTitle = el.text.replace(/\s+/g, "").replace(/lock/g, "💲");
                chapters[chapterId] = chapterTitle;
            });
            
            // 解析推荐漫画
            const recommend = [];
            const recommendElements = html.querySelectorAll(".rec-list li");
            recommendElements.forEach(el => {
                const titleEl = el.querySelector(".rec-title");
                const coverEl = el.querySelector(".rec-cover img");
                const linkEl = el.querySelector("a");
                
                if (titleEl && coverEl && linkEl) {
                    const comicId = linkEl.attributes.href.match(/id\/(\d+)/)?.[1] || "";
                    if (comicId) {
                        recommend.push(new Comic({
                            id: comicId,
                            title: titleEl.text.trim(),
                            cover: coverEl.attributes.src,
                            subtitle: ""
                        }));
                    }
                }
            });
            
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
                url: url
            });
        },

        loadEp: async (comicId, epId) => {
            // 腾讯漫画的图片需要特殊处理，这里使用原有的解密逻辑
            const url = `https://m.ac.qq.com/comic/chapter/id/${comicId}/cid/${epId}`;
            const response = await Network.get(url, {});
            const result = response.body;
            
            // 提取数据
            const dataMatch = result.match(/data:\s*'(.*?)'/);
            const nonceMatch = result.match(/<script>window.*?=(.*?)<\/script>/);
            
            if (!dataMatch || !nonceMatch) {
                throw new Error("无法解析漫画数据");
            }
            
            let data = dataMatch[1];
            let nonce = nonceMatch[1];
            
            // 执行nonce代码
            nonce = eval(nonce);
            const N = String(nonce).match(/\d+\w+/g);
            
            if (!N) {
                throw new Error("无法解析nonce");
            }
            
            // 解密数据
            let jlen = N.length;
            while (jlen) {
                jlen -= 1;
                const jlocate = parseInt(N[jlen].match(/(\d+)/)[0]) & 255;
                const jstr = N[jlen].replace(/\d+/g, '');
                data = data.substring(0, parseInt(jlocate)) + data.substring(parseInt(jlocate) + jstr.length, data.length);
            }
            
            // 解码并解析图片列表
            const decoded = Convert.decodeBase64(data);
            const decodedStr = Convert.decodeUtf8(decoded);
            const picMatch = decodedStr.match(/"picture":(\[{"url".*?\])/);
            
            if (!picMatch) {
                throw new Error("无法解析图片列表");
            }
            
            const picList = JSON.parse(picMatch[1]);
            const images = picList.map(pic => pic.url);
            
            return { images: images };
        },

        onImageLoad: (url, comicId, epId) => {
            // 可以在这里添加特定的请求头
            return {
                url: url,
                headers: {
                    "Referer": `https://m.ac.qq.com/comic/chapter/id/${comicId}/cid/${epId}`
                }
            };
        },

        idMatch: "https?://m\\.ac\\.qq\\.com/comic/index/id/(\\d+)",
        
        link: {
            domains: ['m.ac.qq.com', 'ac.qq.com'],
            linkToId: (url) => {
                const match = url.match(/comic\/index\/id\/(\d+)/);
                return match ? match[1] : null;
            }
        }
    }

    // 辅助方法：解析漫画列表
    parseComicList(html) {
        const comics = [];
        
        // 尝试多种选择器
        const selectors = [
            "#lst_searchResult li",
            "#list_update li",
            ".comic-link",
            ".rec-list li",
            ".rank-item",
            ".category-list li"
        ];
        
        for (const selector of selectors) {
            const elements = html.querySelectorAll(selector);
            if (elements.length > 0) {
                elements.forEach(el => {
                    try {
                        const comic = this.parseComicElement(el);
                        if (comic) {
                            comics.push(comic);
                        }
                    } catch (error) {
                        console.error("解析漫画元素失败:", error);
                    }
                });
                break;
            }
        }
        
        return comics;
    }

    // 辅助方法：解析单个漫画元素
    parseComicElement(element) {
        // 获取链接
        const linkEl = element.querySelector("a");
        if (!linkEl) return null;
        
        const href = linkEl.attributes.href;
        const comicId = href ? href.match(/id\/(\d+)/)?.[1] : null;
        if (!comicId) return null;
        
        // 获取封面
        const coverEl = element.querySelector("img");
        const cover = coverEl?.attributes.src || "";
        
        // 获取标题
        const titleEl = element.querySelector(".comic-title") || 
                       element.querySelector(".rec-title") ||
                       element.querySelector(".rank-title") ||
                       element.querySelector("h3") ||
                       element.querySelector("h4");
        const title = titleEl?.text.trim() || "";
        
        // 获取描述/作者
        const descEl = element.querySelector(".comic-tag") ||
                      element.querySelector(".rec-author") ||
                      element.querySelector(".rank-author");
        const subtitle = descEl?.text.trim() || "";
        
        // 获取更新信息
        const updateEl = element.querySelector(".chapter") ||
                        element.querySelector(".comic-update") ||
                        element.querySelector(".rec-update") ||
                        element.querySelector(".rank-update");
        const lastChapter = updateEl?.text.replace("更新", "").trim() || "";
        
        return new Comic({
            id: comicId,
            title: title,
            subtitle: subtitle,
            cover: cover,
            description: lastChapter,
            tags: []
        });
    }

    // 设置项
    settings = {
        imageQuality: {
            title: "图片质量",
            type: "select",
            options: [
                { value: "high", text: "高质量" },
                { value: "medium", text: "中等质量" },
                { value: "low", text: "低质量" }
            ],
            default: "high"
        },
        useWebview: {
            title: "使用WebView解析",
            type: "switch",
            default: false,
            description: "启用后使用WebView解析页面，可能更稳定但速度较慢"
        }
    }

    // 翻译
    translation = {
        'zh_CN': {
            '腾讯漫画': '腾讯漫画',
            '排行榜': '排行榜',
            '分类浏览': '分类浏览',
            '分类': '分类',
            '漫画类型': '漫画类型',
            '图片质量': '图片质量',
            '使用WebView解析': '使用WebView解析',
            '高质量': '高质量',
            '中等质量': '中等质量',
            '低质量': '低质量',
            '启用后使用WebView解析页面，可能更稳定但速度较慢': '启用后使用WebView解析页面，可能更稳定但速度较慢'
        },
        'en': {
            '腾讯漫画': 'Tencent Comic',
            '排行榜': 'Rankings',
            '分类浏览': 'Category Browser',
            '分类': 'Category',
            '漫画类型': 'Comic Types',
            '图片质量': 'Image Quality',
            '使用WebView解析': 'Use WebView Parser',
            '高质量': 'High Quality',
            '中等质量': 'Medium Quality',
            '低质量': 'Low Quality',
            '启用后使用WebView解析页面，可能更稳定但速度较慢': 'After enabling, use WebView to parse pages, may be more stable but slower'
        }
    }
}

// 注册源
ComicSource.sources.tencent_comic = new TencentComicSource();
