- 针对 window.electronAPI：在渲染层统一封装一个 electronAPI 适配器，启动时检测是否存在， 
    若无则提供模拟实现（例如返回默认配置、mock 资源监控数据、直接用 navigator.clipboard    
    等）。Widget/App 初始化先判断该适配器再执行 IPC，保证 npm run dev 下不会直接抛错，同时 
    在 UI 上提示“Electron API 不可用，仅展示示例数据”。
  - 针对 Obsidian secrets：parseYAMLLike/formatYAMLLike 带来的破坏性写入需要替换为真实     
    YAML/Markdown 解析。可以引入轻量 YAML 库（如 yaml）或在 writeAllSecrets/updateSecret   
    时只修改目标字段并保留其他文本区块。关键是避免把多层结构压扁成 key: value 行，否则     
    secrets 会被永久损坏。
  - 针对 widget 配置更新：useWidgetConfig 不应直接绕过 configManager。改为调用
    configManager.updateSection/saveConfig，或先通过 configManager 拉取最新配置再写回，并确
    保 configManager 的 notifyListeners() 会触发全局订阅。这样 Sidebar/Navigation/其它依赖 
    配置的组件才能立即响应 widget 内部的配置修改。