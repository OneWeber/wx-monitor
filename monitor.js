import {
  REPORT_TYPE,
  REPORT_MAP,
  EVENT_TYPE
} from "./constant";
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
      this.reportCacheList = [];
      this.cacheTimeout = options?.cacheTimeout || 10000; // 缓存时间为10秒
      this.reportMass = options?.reportMass || 100; // 上报体量
      this.isPendding = false;
      this.init();
  }

  init() {
      this.setupGlobalErrorHandler();
      this.setupUnhandledRejectionHandler();
      this.getLocation();
      this.getSystemInfo();
  }

  reportHandler(type, reportType, message, extraInfo) {
      if (IMMEDIATELY.includes(reportType)) {
          if (!this.isPendding) {
              if (this.reportCache !== {}) {
                  this.isPendding = true
                  const keys = Object.keys(this.reportCache);
                  keys.forEach(async (v) => {
                      await this.report(v);
                  });
                  this.isPendding = false
              }
              if (this.reportCacheList.length) {
                  this.isPendding = true
                  this.reportList([...this.reportCacheList])
              }
          }
          
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
              error?.message || error,
              error?.stack || error,
          );
      });
  }

  setupUnhandledRejectionHandler() {
      wx.onUnhandledRejection((event) => {
          this.reportHandler(
              REPORT_TYPE["CODE"],
              REPORT_MAP["CODE"]["UNHANDLED_REJECTION"],
              event.reason.message,
              event.reason.stack,
          );
      });
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
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const seconds = date.getSeconds().toString().padStart(2, "0");

      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  processReport(type, reportType, message, extraInfo) {
      const _this = this;
      wx.getNetworkType({
          success: (res) => {
              try {
                  const pages = getCurrentPages();
                  const currentPage = pages[pages.length - 1];
                  const page = extraInfo?.page ?
                      extraInfo.page :
                      currentPage ?
                          currentPage.route :
                          "";
                  const options = extraInfo?.options ?
                      extraInfo?.options :
                      currentPage ?
                          currentPage.options :
                          {};

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
                          createOn: new Date().getTime(),
                          location: _this.location,
                          systemInfo: _this.systemInfo,
                          networkType: res.networkType,
                          env: __wxConfig.envVersion,
                          business: _this.business,
                          appName: _this.appName,
                          extraInfo,
                          reportCount: 0,
                          unionId: _this.unionId,
                          ..._this.customObj,
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
          fail: () => { },
      });
  }
  isHit(probability) {
      if (probability < 0 || probability > 100) {
          throw new Error("概率必须在 0 到 100 之间");
      }
      // 生成一个 0 到 100 之间的随机数
      const randomNum = Math.random() * 100;
  
      // 判断随机数是否在概率范围内
      return randomNum <= probability;
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
                      createOn: new Date().getTime(),
                      extraInfo,
                      location: _this.location,
                      systemInfo: _this.systemInfo,
                      networkType: res.networkType,
                      reportType,
                      env: __wxConfig.envVersion,
                      business: _this.business,
                      appName: _this.appName,
                      unionId: _this.unionId,
                      ..._this.customObj,
                  };
                  if (["GLOBAL_ERROR", "UNHANDLED_REJECTION", "REQUEST_FAIL", "REQUEST_SUCCESS"].includes(reportType)) {
                      if (_this.cb) {
                          _this.cb(errorInfo)
                      } else {
                          _this.reportRequest(errorInfo)
                      }
                  } else {
                      if (_this.isHit(_this.reportMass)) {
                          _this.reportCacheList.push(errorInfo)
                      }
                  }
              } catch (error) {
                  console.error("上报出错:", error);
              }
          },
          fail(err) {
              console.log("失败===", err);
          },
      });
  }

  report(key) {
      try {
          const info = this.reportCache[key];
          delete this.reportCache[key];
          if (this.cb) {
              this.cb(info);
          } else {
              this.reportRequest(info);
          }
      } catch (error) {
          console.error("合并上报异常:", error);
      }
  }

  reportList(data) {
      const l = JSON.parse(JSON.stringify(data));
      l.forEach(v => {
          v.category = 'report'
      })
      const _this = this;
      if (this.cb) {
          this.cb(l);
          this.reportCacheList = [];
          this.isPendding = false;
      } else {
          wx.request({
              url: this.reportUrl,
              data: l,
              header: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                  "X-Requested-With": "XMLHttpRequest",
                  Usertoken: "75b0bebe3c3146edb6b639fcfe2e6640"
              },
              method: "POST",
              sslVerify: true,
              success: (res) => {
                  _this.reportCacheList = [];
                  _this.isPendding = false
              },
              fail: (error) => {
                  _this.isPendding = false
              },
          });
      }
  }

  reportRequest(info) {
      wx.request({
          url: this.reportUrl,
          data: {
              ...info,
              category: 'report'
          },
          header: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Requested-With": "XMLHttpRequest",
          },
          method: "POST",
          sslVerify: true,
          success: (res) => { },
          fail: (error) => { },
      });
  }
}

module.exports = ErrorMonitor;