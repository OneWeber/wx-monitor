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
                    page: extraInfo?.page ? extraInfo.page : currentPage ? currentPage.route : "",
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
                    appName: _this.appName
                };
                console.log("上报信息", errorInfo);
            },
        });
    }

    captureScreenshot() {
        const ctx = wx.createCanvasContext("canvas-id");
        ctx.draw(false, () => {
            wx.canvasToTempFilePath({
                canvasId: "canvas-id",
                success: async function (res) {
                    const _baseUrl = "http://arsenalgw.qa.ly.com/jq-customer/1";
                    const header = {
                        "content-type": "multipart/form-data",
                        token: "62986665b1e3c1601ecd8d7b",
                        traceSource: "traceSource",
                    };
                    header.Cookie = `SessionToken=${wx.getStorageSync("mall.sessionToken")}`;
                    wx.uploadFile({
                        url: `${_baseUrl}/seller/products/uploadImgOrigin/600025`,
                        filePath: res.tempFilePath,
                        header,
                        name: "file",
                        success: (res) => {
                            console.log("上传结果===", res);
                        },
                        fail: (err) => {
                            console.log("上传失败====", err);
                        },
                    });
                },
                fail(err) {
                    console.log("错误信息", err);
                },
            });
        });
    }
}

module.exports = ErrorMonitor;
