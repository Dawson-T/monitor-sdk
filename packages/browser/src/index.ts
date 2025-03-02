import { Core, Breadcrumb } from '@heimdallr-sdk/core';
import { IAnyObject, PlatformTypes, BrowserReportType, PageLifeType, ClientInfoType, StoreKeyType, StoreType } from '@heimdallr-sdk/types';
import { generateUUID, beacon, get, imgRequest, post, getCookie, setCookie, getStore } from '@heimdallr-sdk/utils';
import { BrowserOptionsType, BrowserReportPayloadDataType } from './types';
import { nextTick } from './lib/nextTick';
// 基础插件
import jsErrorPlugin from './plugins/jsError';
import promiseErrorPlugin from './plugins/promiseError';
import lifeCyclePlugin from './plugins/lifeCycle';
class BrowserClient extends Core<BrowserOptionsType> {
  private readonly breadcrumb: Breadcrumb<BrowserOptionsType>;
  private diff: number;
  protected sessionID: string;

  constructor(options: BrowserOptionsType) {
    super(options);
    this.diff = 0;
    this.breadcrumb = new Breadcrumb(options);
  }

  async initAPP() {
    const { initUrl, app } = this.context;
    const {
      headers: { date },
      data: { data } = {}
    } = await this.report(
      initUrl,
      {
        id: generateUUID(),
        ...app
      },
      BrowserReportType.GET
    );
    this.setDiff(date);
    const { id = '' } = data || {};
    return id;
  }

  isRightEnv() {
    return typeof window !== 'undefined';
  }

  report(url: string, data: IAnyObject, type: BrowserReportType = BrowserReportType.BEACON) {
    if (type === BrowserReportType.BEACON && navigator.sendBeacon) {
      beacon(url, data);
      return;
    }
    if (type === BrowserReportType.IMG || !navigator.sendBeacon) {
      imgRequest(url, data);
      return;
    }
    if (type === BrowserReportType.POST) {
      post(url, data);
      return;
    }
    return get(url, data);
  }

  transform(datas: IAnyObject): BrowserReportPayloadDataType {
    if (!datas) {
      return null;
    }
    
    if (!this.sessionID) {
      this.sessionID = getStore(StoreType.SESSION, StoreKeyType.SESSION_ID);
      if (!this.sessionID) {
        return null;
      }
    }

    let uid = getCookie(StoreKeyType.USER_ID);
    if (!uid) {
      uid = generateUUID();
      setCookie(StoreKeyType.USER_ID, uid, 180);
    }

    let extDatas: ClientInfoType = {};
    const {
      dat: { st }
    } = datas;
    const { href } = location;
    if (st === PageLifeType.LOAD) {
      const { userAgent, language } = navigator;
      const { title, documentElement, body } = document;
      const { innerWidth, innerHeight } = window;
      extDatas = {
        ttl: title,
        /** 站点语言 */
        lan: language,
        /** 浏览器标识 */
        ua: userAgent,
        ws: `${innerWidth}x${innerHeight}`,
        ds: `${documentElement.clientWidth || body.clientWidth}x${documentElement.clientHeight || body.clientHeight}`
      };
    }

    return {
      /** 会话id */
      sid: this.sessionID,
      /** 独立用户id */
      uid,
      p: PlatformTypes.BROWSER,
        url: href,
      ...extDatas,
      ...datas
    };
  }

  nextTick(cb: Function, ctx: Object, ...args: any[]) {
    return nextTick(cb, ctx, ...args);
  }

  setDiff(date: string) {
    const serverDate = new Date(date);
    const inDiff = Date.now() - serverDate.getTime();
    if (!this.diff || this.diff > inDiff) {
      this.diff = inDiff;
    }
  }

  getTime() {
    return Date.now() - (this.diff || 0);
  }
}

const init = (options: BrowserOptionsType) => {
  const client = new BrowserClient(options);
  const { plugins = [] } = options;
  client.use([jsErrorPlugin.call(client, options), promiseErrorPlugin, lifeCyclePlugin.call(client, options), ...plugins]);
};

export default init;
