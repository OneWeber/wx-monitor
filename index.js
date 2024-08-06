import Monitor from "./monitor";
import {
    REPORT_TYPE,
    REPORT_MAP,
    APP_LIFECYCLE,
    PAGE_LIFECYCLE,
    COMPONENT_LIFECYCLE,
    CUSTOM_EVENT_TITLE,
} from "./constant";
/**
 *
 * @param {*} options
 *
 * @param reportUrl 上报地址
 *
 * @param business 业务线
 *
 * @param appName 小程序名字
 *
 * @param appLifecycle 需要监听的app生命周期
 *
 * @param pageLifecycle 需要监听的page生命周期
 *
 * @param componentLifecycle 需要监听的component生命周期
 *
 * @param customHandleTitle 自定义需要监听事件头部名字
 */

let monitor = null;
let appLifecycleD = null,
    pageLifecycleD = null,
    componentLifecycleD = null,
    customHandleTitleD = CUSTOM_EVENT_TITLE;

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
        cb
    } = options || {};
    // 实例化监控上报方法
    monitor = new Monitor({ reportUrl, business, appName, unionId, isMergeReport, cacheTimeout, cb });
    appLifecycleD = appLifecycle;
    pageLifecycleD = pageLifecycle;
    componentLifecycleD = componentLifecycle;
    customHandleTitleD = customHandleTitle;
    const originalApp = App;

    // 定义一个新的 App 函数
    App = function (appOptions) {
        const enhancedAppOptions = createAppHandler(appOptions);
        originalApp(enhancedAppOptions);
    };

    const originalPage = Page;

    // 定义一个新的 Page 函数
    Page = function (pageOptions) {
        const enhancedPageOptions = createPageHandler(pageOptions);
        originalPage(enhancedPageOptions);
    };

    const originalComponent = Component;

    // 定义一个新的 Component 函数
    Component = function (componentOptions) {
        const componentName = componentOptions.name || "UnnamedComponent"; // 获取组件名称
        const enhancedComponentOptions = createComponentHandler(componentOptions, componentName);
        originalComponent(enhancedComponentOptions);
    };
};

function createAppHandler(appOptions) {
    (appLifecycleD && Array.isArray(appLifecycleD) ? appLifecycleD : APP_LIFECYCLE).forEach(
        (methodName) => {
            const originalMethod = appOptions[methodName];
            appOptions[methodName] = function (...args) {
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

function createHandler(handler, type, context) {
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
            log.componentPath = context.is // 添加组件名称信息
        }

        monitor?.reportHandler(t, rt, handler.name, log);

        if (handler && !handler._isWrapped) {
            return handler.apply(context, args);
        }
    };
}

function createPageHandler(pageOptions) {
    (pageLifecycleD && Array.isArray(pageLifecycleD) ? pageLifecycleD : PAGE_LIFECYCLE).forEach(
        (methodName) => {
            const originalMethod = pageOptions[methodName];
            if (typeof originalMethod === "function" && !originalMethod._isWrapped) {
                pageOptions[methodName] = function (...args) {
                    return createHandler(originalMethod, "Page LifeCycle", this).apply(this, args);
                };
                pageOptions[methodName]._isWrapped = true;
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

    (componentLifecycleD && Array.isArray(componentLifecycleD)
        ? componentLifecycleD
        : COMPONENT_LIFECYCLE
    ).forEach((methodName) => {
        const originalMethod = componentOptions[methodName];
        if (typeof originalMethod === "function" && !originalMethod._isWrapped) {
            componentOptions[methodName] = function (...args) {
                return createHandler(originalMethod, "Component LifeCycle", this).apply(this, args);
            };
            componentOptions[methodName]._isWrapped = true;
        }
    });

    Object.keys(componentOptions).forEach((key) => {
        if (
            typeof componentOptions[key] === "function" &&
            key.startsWith("handle") &&
            !componentOptions[key]._isWrapped
        ) {
            const originalMethod = componentOptions[key];
            componentOptions[key] = function (...args) {
                return createHandler(originalMethod, "Component Event", this).apply(this, args);
            };
            componentOptions[key]._isWrapped = true;
        }
    });

    return componentOptions;
}
