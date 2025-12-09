// tencent_comic.js
class TencentComicSource extends ComicSource {
    name = "腾讯漫画📱"
    key = "tencent_comic"
    version = "1.0.0"
    minAppVersion = "1.0.0"
    url = "https://m.ac.qq.com"

    // 搜索功能
    search = {
        load: async (keyword, options, page) => {
            const searchUrl = `https://m.ac.qq.com/search/result?word=${encodeURIComponent(keyword)}&page=${page}`;
            
            try {
                const html = await Network.get(searchUrl);
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                
                const comics = [];
                const items = doc.querySelectorAll(".comic-link, .lst_searchResult li, #list_update li");
                
                for (const item of items) {
                    const comic = new Comic();
                    
                    const titleElem = item.querySelector(".comic-title");
                    if (titleElem) {
                        comic.title = titleElem.textContent.trim();
                    }
                    
                    const linkElem = item.querySelector("a");
                    if (linkElem && linkElem.href) {
                        comic.id = linkElem.href.match(/\/comic\/index\/id\/(\d+)/)?.[1] || 
                                  linkElem.href.match(/id=(\d+)/)?.[1] ||
                                  linkElem.href;
                        comic.url = linkElem.href;
                    }
                    
                    const imgElem = item.querySelector(".comic-cover img, img");
                    if (imgElem && imgElem.src) {
                        comic.cover = imgElem.src;
                    }
                    
                    const tagElem = item.querySelector(".comic-tag");
                    if (tagElem) {
                        comic.author = tagElem.textContent.trim();
                    }
                    
                    const chapterElem = item.querySelector(".chapter, .comic-update");
                    if (chapterElem) {
                        comic.latestChapter = chapterElem.textContent.trim().replace(/更新/, "");
                    }
                    
                    if (comic.title && comic.id) {
                        comics.push(comic);
                    }
                }
                
                return {
                    comics: comics,
                    maxPage: 10
                };
                
            } catch (error) {
                console.error("搜索失败:", error);
                return { comics: [], maxPage: 0 };
            }
        },
        
        optionList: []
    }

    // 探索页面
    explore = [
        {
            title: "腾讯漫画分类",
            type: "multiPartPage",
            
            load: async (page) => {
                return [
                    {
                        title: "条漫",
                        viewMore: "category/tm/upt"
                    },
                    {
                        title: "独家", 
                        viewMore: "category/dj/upt"
                    },
                    {
                        title: "完结",
                        viewMore: "category/wj/upt"
                    },
                    {
                        title: "飙升榜",
                        viewMore: "ranking/rise"
                    }
                ];
            }
        }
    ]

    // 分类页面
    category = {
        title: "腾讯分类",
        parts: [
            {
                name: "类型",
                type: "fixed",
                categories: ["条漫", "独家", "完结", "日漫", "恐怖", "恋爱", "玄幻", "热血"],
                itemType: "category",
                categoryParams: ["tm", "dj", "wj", "rm", "kb", "na", "xh", "rx"]
            }
        ],
        enableRankingPage: true
    }

    // 分类漫画加载
    categoryComics = {
        load: async (category, param, options, page) => {
            const url = `https://m.ac.qq.com/category/listAll?type=${param}&rank=upt&pageSize=30&page=${page}`;
            const html = await Network.get(url);
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            
            const comics = [];
            const items = doc.querySelectorAll(".comic-link");
            
            for (const item of items) {
                const comic = new Comic();
                
                const titleElem = item.querySelector(".comic-title");
                if (titleElem) {
                    comic.title = titleElem.textContent.trim();
                }
                
                const linkElem = item.querySelector("a");
                if (linkElem && linkElem.href) {
                    comic.id = linkElem.href.match(/\/comic\/index\/id\/(\d+)/)?.[1] || linkElem.href;
                    comic.url = linkElem.href;
                }
                
                const imgElem = item.querySelector(".comic-cover img");
                if (imgElem && imgElem.src) {
                    comic.cover = imgElem.src;
                }
                
                if (comic.title && comic.id) {
                    comics.push(comic);
                }
            }
            
            return {
                comics: comics,
                maxPage: 50
            };
        },
        
        ranking: {
            options: ["day-日榜", "week-周榜", "month-月榜"],
            load: async (option, page) => {
                const rankMap = {
                    "day": "rise",
                    "week": "hot", 
                    "month": "pay"
                };
                
                const url = `https://m.ac.qq.com/rank/index?type=${rankMap[option] || "rise"}&pageSize=10&page=${page}`;
                const html = await Network.get(url);
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                
                const comics = [];
                const items = doc.querySelectorAll(".rank-item, .comic-link");
                
                // ... 解析逻辑类似上面
                
                return {
                    comics: comics,
                    maxPage: 10
                };
            }
        }
    }

    // 漫画详情
    comic = {
        loadInfo: async (id) => {
            const url = `https://m.ac.qq.com/comic/index/id/${id}`;
            const html = await Network.get(url);
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            
            const details = new ComicDetails();
            details.id = id;
            
            // 解析标题
            const titleElem = doc.querySelector(".head-title-tags h1");
            if (titleElem) {
                details.title = titleElem.textContent.trim();
            }
            
            // 解析作者
            const authorElem = doc.querySelector(".head-info-author");
            if (authorElem) {
                details.author = authorElem.textContent.trim().replace(/作者：/, "");
            }
            
            // 解析简介
            const descElem = doc.querySelector(".head-info-desc");
            if (descElem) {
                details.description = descElem.textContent.trim();
            }
            
            // 解析封面
            const coverElem = doc.querySelector(".head-info-cover img");
            if (coverElem && coverElem.src) {
                details.cover = coverElem.src;
            }
            
            // 解析章节列表
            const chapters = [];
            const chapterElems = doc.querySelectorAll(".chapter-wrap-list.normal > li");
            
            for (const elem of chapterElems) {
                const link = elem.querySelector("a");
                if (link) {
                    const chapter = new Chapter();
                    chapter.title = link.textContent.trim()
                        .replace(/chapter-link/g, '')
                        .replace(/\s/g, '')
                        .replace(/lock/g, '💲');
                    chapter.id = link.href.match(/cid=(\d+)/)?.[1] || link.href;
                    chapter.url = link.href;
                    chapters.push(chapter);
                }
            }
            
            details.chapters = chapters;
            
            return details;
        },
        
        loadEp: async (comicId, epId) => {
            // 简化的图片加载（需要后续完善解密）
            const url = epId.includes("http") ? epId : `https://m.ac.qq.com/comic/chapter/id/${comicId}/cid/${epId}`;
            const html = await Network.get(url);
            
            // 暂时返回占位符，需要实现解密
            return {
                images: ["https://via.placeholder.com/800x1200/FF6B6B/FFFFFF?text=需要解密实现"]
            };
        }
    }
}

// ⚠️ 重要：不要在Venera的输入框中粘贴这行！
// 当作为文件导入时，Venera会自动处理注册
// registerSource(TencentComicSource);
