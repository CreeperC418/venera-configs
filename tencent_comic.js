class TencentComicSource extends ComicSource {
    // 基本信息
    name = "腾讯漫画"
    key = "tencent_comic"
    version = "1.0.0"
    minAppVersion = "1.0.0"
    url = "https://github.com/venera-app/venera-configs"

    // 初始化函数
    init() {
        // 可以在这里做一些初始化工作
    }

    // 探索页面配置
    explore = [
        {
            title: "排行榜",
            type: "multiPartPage",
            load: async (page) => {
                const sections = [
                    {
                        title: "飙升榜",
                        url: "https://m.ac.qq.com/rank/index?type=rise&pageSize=30&page=1"
                    },
                    {
                        title: "畅销榜",
                        url: "https://m.ac.qq.com/rank/index?type=pay&pageSize=30&page=1"
                    },
                    {
                        title: "新作榜",
                        url: "https://m.ac.qq.com/rank/index?type=new&pageSize=30&page=1"
                    },
                    {
                        title: "真香榜",
                        url: "https://m.ac.qq.com/rank/index?type=hot&pageSize=30&page=1"
                    }
                ];

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
