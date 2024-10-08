import Monitor from "./monitor";
import {
    REPORT_TYPE,
    REPORT_MAP,
    APP_LIFECYCLE,
    PAGE_LIFECYCLE,
    COMPONENT_LIFECYCLE,
    CUSTOM_EVENT_TITLE,
} from "./constant";

let monitor = null;
let appLifecycleD = null,
    pageLifecycleD = null,
    componentLifecycleD = null,
    customHandleTitleD = CUSTOM_EVENT_TITLE,
    reportMass=100,
    performanceUrl = '';
let uId = "",
    aName = "",
    aBusiness = "";
export const core = function (options) {
    if (!wx) {
        throw new Error("请确认当前环境是否为微信小程序");
    }
    const {
        reportUrl,
        business,
        appName,
        unionId,
        appLifecycle,
        pageLifecycle,
        componentLifecycle,
        customHandleTitle = CUSTOM_EVENT_TITLE,
        isMergeReport,
        cacheTimeout,
        cb,
        configUrl,
        performanceUrl
    } = options || {};
    if (!reportUrl) {
        throw new Error("请传入reportUrl");
    }
    if (!performanceUrl) {
        throw new Error("请传入performanceUrl");
    }
    uId = unionId;
    aName = appName;
    aBusiness = business;
    if (configUrl) {
        wx.request({
            url: configUrl,
            data: {
                app_name: appName,
                business: business
            },
            header: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
            method: "POST",
            sslVerify: true,
            success: (res) => {
                const rm = res.data.data.report_mass
                console.log('rm====', rm)
                monitor = new Monitor({
                    reportUrl,
                    business,
                    appName,
                    unionId,
                    isMergeReport,
                    cacheTimeout,
                    cb,
                    reportMass: rm
                });
            },
            fail: (error) => {
                monitor = new Monitor({
                    reportUrl,
                    business,
                    appName,
                    unionId,
                    isMergeReport,
                    cacheTimeout,
                    cb,
                    reportMass
                });
            },
        });
    } else {
        // 实例化监控上报方法
        monitor = new Monitor({
            reportUrl,
            business,
            appName,
            unionId,
            isMergeReport,
            cacheTimeout,
            cb,
            reportMass
        });
    }
    
    appLifecycleD = appLifecycle;
    pageLifecycleD = pageLifecycle;
    componentLifecycleD = componentLifecycle;
    customHandleTitleD = customHandleTitle;

    const originalApp = App;

    // 劫持 App 构造函数
    App = function (appOptions) {
        const enhancedAppOptions = createAppHandler(appOptions);
        originalApp(enhancedAppOptions);
    };

    const originalPage = Page;

    // 劫持 Page 构造函数
    Page = function (pageOptions) {
        const enhancedPageOptions = createPageHandler(pageOptions);
        originalPage(enhancedPageOptions);
    };

    const originalComponent = Component;

    // 劫持 Component 构造函数
    Component = function (componentOptions) {
        const componentName = componentOptions.name || "UnnamedComponent"; // 获取组件名称
        const enhancedComponentOptions = createComponentHandler(componentOptions, componentName);
        originalComponent(enhancedComponentOptions);
    };

    // 为 Page 和 Component 添加默认的生命周期方法
    addDefaultLifecycleMethods(Page.prototype, PAGE_LIFECYCLE, "Page");
    addDefaultLifecycleMethods(Component.prototype, COMPONENT_LIFECYCLE, "Component");
};

// 添加默认生命周期方法
function addDefaultLifecycleMethods(proto, lifecycleList, type) {
    lifecycleList.forEach((methodName) => {
        if (typeof proto[methodName] !== "function") {
            proto[methodName] = function (...args) {
                const log = {
                    type: "function",
                    time: new Date().toISOString(),
                    belong: type,
                    method: methodName,
                    arguments: args,
                    ...(type === "Page" && this.route
                        ? { page: this.route, options: this.options }
                        : {}),
                    ...(type === "Component" ? { componentPath: this.is } : {}),
                };
                const reportType =
                    type === "Page"
                        ? REPORT_MAP["LIFECYCLE"]["PAGE_LIFECYCLE"]
                        : REPORT_MAP["LIFECYCLE"]["COMPONENT_LIFECYCLE"];
                monitor?.reportHandler(REPORT_TYPE["LIFECYCLE"], reportType, methodName, log);
            };
        }
    });
}

function createAppHandler(appOptions) {
    (appLifecycleD && Array.isArray(appLifecycleD) ? appLifecycleD : APP_LIFECYCLE).forEach(
        (methodName) => {
            const originalMethod = appOptions[methodName];
            appOptions[methodName] = function (...args) {
                if (methodName === "onShow") {
                    collectPerformanceData();
                }
                const breadcrumb = {
                    type: "function",
                    time: new Date().toISOString(),
                    belong: "App",
                    method: methodName,
                    path: args[0] && args[0].path,
                    query: args[0] && args[0].query,
                    scene: args[0] && args[0].scene,
                };
                monitor?.reportHandler(
                    REPORT_TYPE["LIFECYCLE"],
                    REPORT_MAP["LIFECYCLE"]["APP_LIFECYCLE"],
                    methodName,
                    breadcrumb,
                );
                if (originalMethod) {
                    originalMethod.apply(this, args);
                }
            };
        },
    );

    return appOptions;
}

function createHandler(handler, type, context, performance) {
    return function (...args) {
        const log = {
            type: type,
            time: new Date().toISOString(),
            method: handler.name || "anonymous",
            arguments: args,
        };
        let t = "",
            rt = "";
        if (type.includes("Event")) {
            t = REPORT_TYPE["EVENT"];
            if (type.includes("Page")) {
                rt = REPORT_MAP["EVENT"]["PAGE_EVENT"];
            } else {
                rt = REPORT_MAP["EVENT"]["COMPONENT_EVENT"];
            }
        } else {
            t = REPORT_TYPE["LIFECYCLE"];
            if (type.includes("Page")) {
                rt = REPORT_MAP["LIFECYCLE"]["PAGE_LIFECYCLE"];
            } else {
                rt = REPORT_MAP["LIFECYCLE"]["COMPONENT_LIFECYCLE"];
            }
        }
        if (type.includes("Page") && context && context.route) {
            log.page = context.route;
            log.options = context.options;
        } else if (type.includes("Component") && context) {
            log.componentPath = context.is; // 添加组件名称信息
        }
        if (performance && performance.length) {
            log.performance = performance;
        }
        monitor?.reportHandler(t, rt, handler.name, log);

        if (handler && !handler._isWrapped) {
            return handler.apply(context, args);
        }
    };
}

let collectPerformanceArray = [];

function collectPerformanceData(route) {
    if (wx.canIUse("getPerformance")) {
        const accountInfo = wx.getAccountInfoSync();
        const currentVersion = accountInfo.miniProgram?.version || "";
        const performance = wx.getPerformance();
        const performanceObserver = performance.createObserver((entryList) => {
            const entryArray = entryList.getEntries();
            entryArray.forEach((element) => {
                const { duration } = element;
                if (duration) {
                    collectPerformanceArray.push({
                        ...element,
                        unionId: uId,
                        appName: aName,
                        createOn: Date.now(),
                        business: aBusiness,
                        env: __wxConfig.envVersion,
                        version: currentVersion,
                        category: 'performance',
                        type: element.name
                    });
                }
            });
        });
        performanceObserver.observe({
            entryTypes: ["navigation", "render", "script", , "loadPackage", "resource"],
        });
    }
}

let updatePerformanceListenerArray = [];
let actionTime = "";
const frequencyLimit = 10;
const timeLimit = 50;
let lastUpdateTimestamp = 0;
let setDataFrequency = 0;
let setDataFrequencyArray = [];
function setUpdatePerformanceListenerFunc(_this, route, componentPath) {
    // jank_times: 1秒内setData频率大于10次的次数  stutter_times: 单次setData耗时大于50ms的次数
    try {
        _this.setUpdatePerformanceListener({ withDataPaths: true }, (res) => {
            const { updateStartTimestamp, updateEndTimestamp, dataPaths } = res;
            if (route && Array.isArray(dataPaths) && dataPaths.length) {
                const accountInfo = wx.getAccountInfoSync();
                const currentVersion = accountInfo.miniProgram?.version || "";
                const updateTime = updateEndTimestamp - updateStartTimestamp; // 计算单次 setData 的耗时
                // 单次赋值耗时超过50ms
                if (updateTime > timeLimit) {
                    if (componentPath && componentPath.indexOf("miniprogram_npm") === -1) {
                        updatePerformanceListenerArray.push({
                            createOn: updateStartTimestamp,
                            page: route,
                            component: componentPath,
                            type: "stutter_times",
                            dataPaths: [...dataPaths.map((v) => v[0])],
                            updateStartTimestamp,
                            updateEndTimestamp,
                            unionId: uId,
                            appName: aName,
                            business: aBusiness,
                            env: __wxConfig.envVersion,
                            version: currentVersion,
                            category: 'setData'
                        });
                    } else if (!componentPath) {
                        updatePerformanceListenerArray.push({
                            createOn: updateStartTimestamp,
                            page: route,
                            type: "stutter_times",
                            dataPaths: [...dataPaths.map((v) => v[0])],
                            updateStartTimestamp,
                            updateEndTimestamp,
                            unionId: uId,
                            appName: aName,
                            business: aBusiness,
                            env: __wxConfig.envVersion,
                            version: currentVersion,
                            category: 'setData'
                        });
                    }
                }
                const now = Date.now();
                if (lastUpdateTimestamp && now - lastUpdateTimestamp < 1000) {
                    if (setDataFrequency === 0) {
                        actionTime = updateStartTimestamp;
                    }
                    setDataFrequency += 1;
                    setDataFrequencyArray = [
                        ...setDataFrequencyArray,
                        ...dataPaths.map((v) => v[0]),
                    ];
                } else {
                    if (setDataFrequency > frequencyLimit) {
                        if (componentPath && componentPath.indexOf("miniprogram_npm") === -1) {
                            updatePerformanceListenerArray.push({
                                createOn: actionTime,
                                page: route,
                                component: componentPath,
                                type: "jank_times",
                                dataPaths: [...setDataFrequencyArray],
                                unionId: uId,
                                appName: aName,
                                business: aBusiness,
                                env: __wxConfig.envVersion,
                                version: currentVersion,
                                category: 'setData'
                            });
                        } else if (!componentPath) {
                            updatePerformanceListenerArray.push({
                                createOn: actionTime,
                                page: route,
                                type: "jank_times",
                                dataPaths: [...setDataFrequencyArray],
                                unionId: uId,
                                appName: aName,
                                business: aBusiness,
                                env: __wxConfig.envVersion,
                                version: currentVersion,
                                category: 'setData'
                            });
                        }
                    }
                }
            }
        });
    } catch (error) {}
}

function uploadData(info, type) {
    wx.request({
        url: performanceUrl,
        data: info,
        header: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
        },
        method: "POST",
        sslVerify: true,
        success: (res) => {},
        fail: (error) => {},
    });
    if (type === "setData") {
        updatePerformanceListenerArray = [];
        actionTime = "";
        lastUpdateTimestamp = 0;
        setDataFrequency = 0;
        setDataFrequencyArray = [];
    } else {
        collectPerformanceArray = [];
    }
}

function createPageHandler(pageOptions) {
    (pageLifecycleD && Array.isArray(pageLifecycleD) ? pageLifecycleD : PAGE_LIFECYCLE).forEach(
        (methodName) => {
            const originalMethod = pageOptions[methodName];
            if (typeof originalMethod === "function" && !originalMethod._isWrapped) {
                let performanceObj = {};
                pageOptions[methodName] = async function (...args) {
                    if (methodName === "onLoad") {
                        setUpdatePerformanceListenerFunc(this, this.route);
                    }
                    if (methodName === "onHide" || methodName === "onUnload") {
                        if (updatePerformanceListenerArray.length) {
                            uploadData(updatePerformanceListenerArray, "setData");
                        }
                        if (collectPerformanceArray.length) {
                            uploadData(collectPerformanceArray, "performance");
                        }
                    }
                    return createHandler(
                        originalMethod,
                        "Page LifeCycle",
                        this,
                        performanceObj,
                    ).apply(this, args);
                };
                pageOptions[methodName]._isWrapped = true;
            } else if (typeof originalMethod !== "function") {
                // 添加默认生命周期方法
                pageOptions[methodName] = function (...args) {
                    const log = {
                        type: "function",
                        time: new Date().toISOString(),
                        belong: "Page",
                        method: methodName,
                        arguments: args,
                        page: this.route,
                        options: this.options,
                    };
                    monitor?.reportHandler(
                        REPORT_TYPE["LIFECYCLE"],
                        REPORT_MAP["LIFECYCLE"]["PAGE_LIFECYCLE"],
                        methodName,
                        log,
                    );
                };
            }
        },
    );
    Object.keys(pageOptions).forEach((key) => {
        if (
            typeof pageOptions[key] === "function" &&
            key.startsWith(customHandleTitleD) &&
            !pageOptions[key]._isWrapped
        ) {
            const originalMethod = pageOptions[key];
            pageOptions[key] = function (...args) {
                return createHandler(originalMethod, "Page Event", this).apply(this, args);
            };
            pageOptions[key]._isWrapped = true;
        }
    });

    return pageOptions;
}

function createComponentHandler(componentOptions, componentName) {
    componentOptions.name = componentName; // 设置组件名称

    // 劫持生命周期方法
    (componentLifecycleD && Array.isArray(componentLifecycleD)
        ? componentLifecycleD
        : COMPONENT_LIFECYCLE
    ).forEach((methodName) => {
        const originalMethod = componentOptions[methodName];
        if (typeof originalMethod === "function" && !originalMethod._isWrapped) {
            componentOptions[methodName] = function (...args) {
                if (methodName === "attached") {
                    const pages = getCurrentPages();
                    const currentPage = pages[pages.length - 1];
                    setUpdatePerformanceListenerFunc(this, currentPage?.route, this.is);
                }
                return createHandler(originalMethod, "Component LifeCycle", this).apply(this, args);
            };
            componentOptions[methodName]._isWrapped = true;
        } else if (typeof originalMethod !== "function") {
            // 添加默认生命周期方法
            componentOptions[methodName] = function (...args) {
                const log = {
                    type: "function",
                    time: new Date().toISOString(),
                    belong: "Component",
                    method: methodName,
                    arguments: args,
                    componentPath: this.is, // 添加组件路径信息
                };
                monitor?.reportHandler(
                    REPORT_TYPE["LIFECYCLE"],
                    REPORT_MAP["LIFECYCLE"]["COMPONENT_LIFECYCLE"],
                    methodName,
                    log,
                );
            };
        }
    });

    // 劫持 methods 中的事件处理函数
    if (componentOptions.methods) {
        Object.keys(componentOptions.methods).forEach((key) => {
            if (
                typeof componentOptions.methods[key] === "function" &&
                key.startsWith(customHandleTitleD) &&
                !componentOptions.methods[key]._isWrapped
            ) {
                const originalMethod = componentOptions.methods[key];
                componentOptions.methods[key] = function (...args) {
                    return createHandler(originalMethod, "Component Event", this).apply(this, args);
                };
                componentOptions.methods[key]._isWrapped = true;
            }
        });
    }

    return componentOptions;
}
