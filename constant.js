export const REPORT_TYPE = {
    'CODE': 'CODE', // 代码层面
    'REQUEST': 'REQUEST', // 请求发起
    'LIFECYCLE': 'LIFECYCLE', // 生命周期
    'EVENT': 'EVENT', // 事件
}

// 代码层面
export const CODE_TYPE = {
    'GLOBAL_ERROR': 'GLOBAL_ERROR',
    'UNHANDLED_REJECTION': 'UNHANDLED_REJECTION'
}

// 请求发起
export const REQUEST_TYPE = {
    'REQUEST_SUCCESS': 'REQUEST_SUCCESS', // 请求成功
    'REQUEST_FAIL': 'REQUEST_FAIL', // 请求失败
}

// 生命周期
export const LIFECYCLE_TYPE = {
    'APP_LIFECYCLE': 'APP_LIFECYCLE', // APP生命周期
    'PAGE_LIFECYCLE': 'PAGE_LIFECYCLE', // 页面生命周期
    'COMPONENT_LIFECYCLE': 'COMPONENT_LIFECYCLE', // 组件生命周期
}

// 事件
export const EVENT_TYPE = {
    'PAGE_EVENT': 'PAGE_EVENT', // 页面事件
    'COMPONENT_EVENT': 'COMPONENT_EVENT', // 组件事件
}

// report映射
export const REPORT_MAP = {
    'CODE': CODE_TYPE,
    'REQUEST': REQUEST_TYPE,
    'LIFECYCLE': LIFECYCLE_TYPE,
    'EVENT': EVENT_TYPE
}

// 需要监听的APP生命周期
export const APP_LIFECYCLE = ["onLaunch", "onShow", "onHide"]

// 需要监听的Page的生命周期
export const PAGE_LIFECYCLE = ["onShow", "onHide", "onLoad", "onUnload"]

// 需要监听的Component的生命周期
export const COMPONENT_LIFECYCLE = ["attached"]

// 自定义事件头命名
export const CUSTOM_EVENT_TITLE = 'handle'