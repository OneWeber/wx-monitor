# 插件说明

本插件为了获取用户操作记录及项目运行异常监控，方便开发人员锁定线上项目报错的导致原因。

- # 功能说明
1. 劫持并重写App，Page，Component生命周期，同时也会保留开发人员自定义的生命周期逻辑。所以无需担心此插件会影响到项目中App及各个页面生命周期的逻辑。该插件支持自定义App，Page，Component监听生命周期，字段分别是、appLifecycle，pageLifecycle，componentLifecycle，如若未传则默认为组件内置的生命周期，如需自定义，如下：core({appLifecycle: ['onLaunch']})。这样App只会监控onLaunch。注：如参数为appLifecycle: []，这种空数组，则表示App任务生命周期都不会被监控。
2. 可以自定义事件监控，上报用户在所有Page或Component中的点击事件。注：如Page或Component中有事件需要监控且上报，需要将事件名前面加上handle，如bind:tap="handleDebug"。同时也可以自定义事件头名，如希望bint:tap="testDebug"这种test开头的方法被监听，只需要在引入插件后执行core()时传入参customHandleTitle=test。如core({customHandleTitle: test})。
3. 支持wx.reqeust请求监控。微信小程序项目中大多都已封装好request公共请求。此插件就没有再去封装request，而是暴露了一个监控类ErrorMonitor。只需要在项目中封装request的文件中引入montitor，然后实例化new ErrorMonitor()，即可在想要监控上报的地方如果发起请求，请求成功返回，失败返回等地方去(new ErrorMonitor()).report()。
4. 支持代码错误监控。此插件支持小程序中代码错误监控，如错误未被catch，线上常出现异常或白屏等，此插件无需再开发，只需在app.js引入插件执行core()即可，该插件已为项目代码监控及上报。

# 上报格式
```javascript
{
    type: string, // 监控类型
    reportType: string, // 上报类型
    message: string, // 提示文本内容
    page: string, // 页面路径
    options: object, // 页面参数
    time: string, // 上报时间
    extraInfo: object | string, // 上报内容
    location: object, // 地点信息
    systemInfo: object, // 手机系统信息
    networkType: string, // 网络状态
    env: string, // 环境
    business: string, // 业务线
    appName: string, // 项目名称
    ...
}
```

- # 入参说明
```javascript
{
    reportUrl: string, // 监控上报地址 required
    business: string, // 业务线
    appName: string, // 小程序名字
    appLifecycle: array, // 需要监听的app生命周期
    pageLifecycle: array, // 需要监听的page生命周期
    componentLifecycle: array, // 需要监听的component生命周期
    customHandleTitle: string, // 自定义需要监听事件头部名字
}
```

- # 监控类型
1. CODE: 代码类型
2. REQUEST: 请求类型
3. LIFECYCLE: 生命周期类型
4. EVENT: 事件类型


- # 待开发项
1. 上报数据到服务端
2. 上报优化，如短时间相同异常只报一次等。

- # 注意事项
1. 目前开发中也能拿到数据了，所以开发者可以拿到数据自己去组装上报服务端的请求。
2. 大家也可以把代码拉到本地自己定义自己需要上报的字段。
3. 注意微信小程序的npm构建，放在miniprogram_npm引入即可使用