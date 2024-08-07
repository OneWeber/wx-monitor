import { REPORT_TYPE, REPORT_MAP, EVENT_TYPE } from "./constant";
const IMMEDIATELY = ["APP_LIFECYCLE", "PAGE_LIFECYCLE"]; // 立即执行的生命周期type
class ErrorMonitor {
  constructor(options) {
    if (!wx) return;
    if (!options.cb && !options?.reportUrl) {
      throw new Error("请传入上报地址");
    }
    this.reportUrl = options?.reportUrl || ""; // 上报地址
    this.business = options?.business || ""; // 业务线
    this.appName = options?.appName || ""; // 应用名称
    this.cb = options?.cb || null; // 用户自定义上报事件回调
    this.unionId = options?.unionId || ""; // 用户唯一标识
    this.isMergeReport = options?.isMergeReport || false; // 是否合并上报
    this.location = null; // 地址信息
    this.systemInfo = null; // 手机系统信息
    this.customObj = options?.customObj || {}; // 自定义上传字段
    this.reportCache = {}; // 用于缓存相似错误报告
    this.cacheTimeout = options?.cacheTimeout || 10000; // 缓存时间为10秒
    this.init();
  }

  init() {
    this.setupGlobalErrorHandler();
    this.setupUnhandledRejectionHandler();
    this.getLocation();
    this.getSystemInfo();
  }

  reportHandler(type, reportType, message, extraInfo) {
    if (IMMEDIATELY.includes(reportType) && this.reportCache !== {}) {
      const keys = Object.keys(this.reportCache);
      keys.forEach((v) => {
        this.report(v);
      });
    }
    if (this.isMergeReport && EVENT_TYPE[reportType]) {
      this.processReport(type, reportType, message, extraInfo);
    } else {
      this.reportImmediately(type, reportType, message, extraInfo);
    }
  }

  setupGlobalErrorHandler() {
    wx.onError((error) => {
      this.reportHandler(
        REPORT_TYPE["CODE"],
        REPORT_MAP["CODE"]["GLOBAL_ERROR"],
        error.message,
        error.stack
      );
    });
  }

  setupUnhandledRejectionHandler() {
    wx.onUnhandledRejection((event) => {
      this.reportHandler(
        REPORT_TYPE["CODE"],
        REPORT_MAP["CODE"]["UNHANDLED_REJECTION"],
        event.reason.message,
        event.reason.stack
      );
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

  processReport(type, reportType, message, extraInfo) {
    const _this = this;
    wx.getNetworkType({
      success: (res) => {
        try {
          const pages = getCurrentPages();
          const currentPage = pages[pages.length - 1];
          const page = extraInfo?.page
            ? extraInfo.page
            : currentPage
            ? currentPage.route
            : "";
          const options = extraInfo?.options
            ? extraInfo?.options
            : currentPage
            ? currentPage.options
            : {};

          const extraInfoKey =
            typeof extraInfo === "object" ? extraInfo.method || "" : message;
          const key = `${page}_${type}_${reportType}_${extraInfoKey}`;

          if (!_this.reportCache[key]) {
            _this.reportCache[key] = {
              type,
              reportType,
              message,
              page,
              options,
              reportTimes: [],
              location: _this.location,
              systemInfo: _this.systemInfo,
              networkType: res.networkType,
              env: __wxConfig.envVersion,
              business: _this.business,
              appName: _this.appName,
              extraInfo,
              reportCount: 0,
              unionId: _this.unionId,
            };

            setTimeout(() => {
              if (_this.reportCache[key]) {
                _this.report(key);
              }
            }, _this.cacheTimeout);
          }

          const errorInfo = _this.reportCache[key];
          errorInfo.reportCount++;
          errorInfo.reportTimes.push(_this.formatDate(new Date()));
        } catch (error) {
          console.error("合并上报出错:", error);
        }
      },
    });
  }

  reportImmediately(type, reportType, message, extraInfo) {
    const _this = this;
    wx.getNetworkType({
      success(res) {
        try {
          const pages = getCurrentPages();
          const currentPage = pages[pages.length - 1];
          let errorInfo = {
            type,
            message,
            page: extraInfo?.page
              ? extraInfo.page
              : currentPage
              ? currentPage.route
              : "",
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
            unionId: _this.unionId,
            ..._this.customObj
          };
          if (_this.cb) {
            _this.cb(errorInfo);
          } else {
            _this.reportRequest();
          }
        } catch (error) {
          console.error("上报出错:", error);
        }
      },
    });
  }

  report(key) {
    try {
      const info = this.reportCache[key];
      delete this.reportCache[key];

      if (info && info.location) {
        info.location = {
          lat: info.location.latitude,
          lon: info.location.longitude,
        };
      } else {
        info.location = { lat: 0, lon: 0 };
      }
      if (this.cb) {
        this.cb(info);
      } else {
        this.reportRequest(info);
      }
    } catch (error) {
      console.error("合并上报异常:", error);
    }
  }

  reportRequest(info) {
    wx.request({
      url: this.reportUrl,
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
  }
}

module.exports = ErrorMonitor;
