import { REPORT_TYPE, REPORT_MAP } from './constant';
class ErrorMonitor {
    constructor(options) {
        if (!wx) return;
        // if (!options?.reportUrl) {
        //     throw new Error('请传入上报地址')
        // }
        this.reportUrl = options?.reportUrl || '';
        this.business = options?.business || '';
        this.appName = options?.appName || '';
        this.cb = options?.cb || null;
        this.unionId = options?.unionId || '';
        this.location = null;
        this.systemInfo = null;
        this.init();
    }

    init() {
        this.setupGlobalErrorHandler();
        this.setupUnhandledRejectionHandler();
        this.getLocation();
        this.getSystemInfo();
    }

    setupGlobalErrorHandler() {
        wx.onError((error) => {
            this.report(REPORT_TYPE['CODE'], REPORT_MAP['CODE']['GLOBAL_ERROR'], error.message, error.stack);
        });
    }

    setupUnhandledRejectionHandler() {
        wx.onUnhandledRejection((event) => {
            this.report(REPORT_TYPE['CODE'], REPORT_MAP['CODE']['UNHANDLED_REJECTION'], event.reason.message, event.reason.stack);
        });
    }

    addSnapshot(snapshot) {
        this.snapshots.push(snapshot);
        if (this.snapshots.length > 10) {
            this.snapshots.shift(); // 只保留最近10张截图
        }
    }

    getLocation() {
        wx.getLocation({
            type: "wgs84",
            success: (res) => {
                this.location = res;
            },
            fail: (err) => {
                console.error("获取地理位置失败", err);
            },
        });
    }

    getSystemInfo() {
        wx.getSystemInfo({
            success: (res) => {
                this.systemInfo = res;
            },
            fail: (err) => {
                console.error("获取系统信息失败", err);
            },
        });
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const day = date.getDate().toString().padStart(2, "0");
        return `${year.toString()}-${month}-${day}`;
    }

    report(type, reportType, message, extraInfo) {
        const _this = this;
        wx.getNetworkType({
            success(res) {
                const pages = getCurrentPages();
                const currentPage = pages[pages.length - 1];
                const errorInfo = {
                    type,
                    message,
                    page: extraInfo?.path ? extraInfo.path : currentPage ? currentPage.route : "",
                    options: extraInfo?.options
                        ? extraInfo?.options
                        : currentPage
                        ? currentPage.options
                        : {},
                    time: _this.formatDate(new Date()),
                    extraInfo,
                    location: _this.location,
                    systemInfo: _this.systemInfo,
                    networkType: res.networkType,
                    reportType,
                    env: __wxConfig.envVersion,
                    business: _this.business,
                    appName: _this.appName,
                    unionId: _this.unionId
                };
                console.log("上报信息", errorInfo);
                if (_this.cb) {
                    _this.cb(errorInfo)
                } else {
                    _this.reportRequest();
                }
                
            },
        });
    }

    reportRequest(info) {
        wx.request({
            url: this.reportUrl,
            data: info,
            header: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            method: 'POST',
            sslVerify: true,
            success: (res) => {},
            fail: (error) => {}
        })
    }
}

module.exports = ErrorMonitor;
