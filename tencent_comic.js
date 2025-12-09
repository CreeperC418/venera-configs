// tencent_comic_debug.js
class TencentComicDebugSource extends ComicSource {
    name = "腾讯漫画调试版"
    key = "tencent_comic"
    version = "1.0.1"
    
    init() {
        console.log("=== 腾讯漫画调试版初始化 ===");
    }
    
    search = {
        load: async (keyword, options, page) => {
            console.log("=== 开始搜索 ===");
            console.log("关键词:", keyword);
            console.log("页码:", page);
            console.log("选项:", options);
            
            try {
                // 1. 构建URL
                const searchUrl = `https://m.ac.qq.com/search/result?word=${encodeURIComponent(keyword)}&page=${page || 1}`;
                console.log("搜索URL:", searchUrl);
                
                // 2. 设置请求头
                const headers = {
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                    "Accept-Encoding": "gzip",
                    "Connection": "keep-alive",
                    "Upgrade-Insecure-Requests": "1",
                    "Referer": "https://m.ac.qq.com/"
                };
                
                // 3. 发送请求
                console.log("发送请求...");
                const startTime = Date.now();
                const html = await Network.get(searchUrl, { 
                    headers: headers,
                    timeout: 15000
                });
                const endTime = Date.now();
                
                console.log("请求完成，耗时:", endTime - startTime, "ms");
                console.log("响应长度:", html?.length || 0);
                
                if (!html) {
                    console.error("响应为空!");
                    return { comics: [], maxPage: 0 };
                }
                
                if (html.length < 500) {
                    console.error("响应太短，可能是错误页面:");
                    console.log(html.substring(0, 500));
                    return { comics: [], maxPage: 0 };
                }
                
                // 4. 检查是否包含特定内容
                if (html.includes("搜索结果")) {
                    console.log("✓ 页面包含'搜索结果'");
                } else {
                    console.log("✗ 页面不包含'搜索结果'");
                }
                
                if (html.includes("comic-link")) {
                    console.log("✓ 页面包含'comic-link'");
                } else {
                    console.log("✗ 页面不包含'comic-link'");
                }
                
                // 5. 尝试简单解析
                console.log("尝试解析HTML...");
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                
                // 检查文档结构
                console.log("文档标题:", doc.title);
                
                // 查找所有链接
                const allLinks = doc.querySelectorAll("a");
                console.log("总链接数:", allLinks.length);
                
                // 查找可能包含漫画的链接
                const comicLinks = [];
                allLinks.forEach((link, index) => {
                    const href = link.href;
                    const text = link.textContent.trim();
                    
                    if (href && href.includes('/comic/')) {
                        comicLinks.push({
                            index: index,
                            href: href,
                            text: text.substring(0, 50)
                        });
                    }
                });
                
                console.log("找到漫画相关链接:", comicLinks.length);
                comicLinks.slice(0, 5).forEach(link => {
                    console.log(`  [${link.index}] ${link.text} -> ${link.href}`);
                });
                
                // 6. 构建测试结果
                const comics = [];
                
                // 如果找到了链接，构建漫画对象
                if (comicLinks.length > 0) {
                    for (let i = 0; i < Math.min(3, comicLinks.length); i++) {
                        const link = comicLinks[i];
                        const comic = new Comic();
                        
                        comic.id = link.href.match(/\/comic\/index\/id\/(\d+)/)?.[1] || 
                                  link.href.match(/id=(\d+)/)?.[1] || 
                                  `link_${i}`;
                        comic.title = link.text || `漫画 ${i+1}`;
                        comic.url = link.href;
                        comic.cover = `https://via.placeholder.com/150x200/4ECDC4/FFFFFF?text=${i+1}`;
                        
                        comics.push(comic);
                    }
                } else {
                    // 返回测试数据
                    comics.push({
                        id: "test_001",
                        title: "测试漫画 - " + keyword,
                        cover: "https://via.placeholder.com/150x200/FF6B6B/FFFFFF?text=测试",
                        author: "测试作者",
                        description: "这是一个测试漫画，因为未能解析到真实结果"
                    });
                }
                
                console.log("返回漫画数:", comics.length);
                
                return {
                    comics: comics,
                    maxPage: 10
                };
                
            } catch (error) {
                console.error("=== 搜索过程中出错 ===");
                console.error("错误类型:", error.constructor.name);
                console.error("错误信息:", error.message);
                console.error("堆栈:", error.stack);
                
                // 返回空结果而不是抛出错误
                return {
                    comics: [],
                    maxPage: 0
                };
            }
        },
        
        optionList: []
    }
    
    // 漫画详情（简化版）
    comic = {
        loadInfo: async (id) => {
            console.log("加载漫画详情:", id);
            
            const details = new ComicDetails();
            details.id = id;
            details.title = "测试漫画详情";
            details.description = "这是一个测试";
            details.cover = "https://via.placeholder.com/300x400";
            details.chapters = [
                { id: "c1", title: "第1话" },
                { id: "c2", title: "第2话" }
            ];
            
            return details;
        },
        
        loadEp: async (comicId, epId) => {
            console.log("加载章节:", comicId, epId);
            return {
                images: ["https://via.placeholder.com/800x1200"]
            };
        }
    }
}
