import * as UtilsCrypto from './utils/Crypto.js';
import { BaseUrls } from './utils/URLBuilders/BaseUrls';
import * as connectService from './services/ConnectService';
import { IConnectConfig, IState, IPayload, IData, IAttributes, IMeta } from './interfaces/connect/ConnectInterface';
import { IConfig } from './interfaces/ConfigInterface';
import { Constants } from './utils/Constants.js';
import { eventNames } from 'cluster';

export class Connect {
  public axios: any;
  public config: IConfig;
  public connectConfig: IConnectConfig;

  private signatureType: string;

  // constructor(app_id: string, app_secret: string, private_key: string, redirect_uri: string, origin_uri: string, state?: string, version?: string){
  constructor(config: IConfig) {
    this.axios = connectService;
    this.config = config;
    this.signatureType = 'rsa-sha256';
  }

  /**
   * Generates a connect URL based on the payment parameters
   *
   * @param {payment} State
   */
  public async getPisConnectUrl(accessToken: string, connectConfig: any) {
    this.config = this._validateConfigIntegrity(this.config);
    this.connectConfig = this._validateConnectConfigIntegrity(connectConfig);

    if (!connectConfig.end_to_end_id) {
      connectConfig.end_to_end_id = UtilsCrypto.generateUUID();
    }

    const payload: IPayload = this._buildPayload(connectConfig);

    const state: IState = {
      app_id: this.config.app_id,
      access_token: accessToken,
      signature_type: this.signatureType,
      signature: this._buildSignature(payload, this.config.private_key, this.signatureType),
      redirect_uri: connectConfig.redirect_uri,
      origin_uri: connectConfig.origin_uri,
      state: connectConfig.state ? connectConfig.state : '',
      order_id: connectConfig.communication,
      payload: payload,
    };

    const url = `${
      this.config.env === Constants.SANDBOXENVIRONMENT
        ? BaseUrls.FINTECTURECONNECTURL_SBX
        : BaseUrls.FINTECTURECONNECTURL_PRD
    }/pis`;

    return `${url}?state=${Buffer.from(JSON.stringify(state)).toString('base64')}`;
  }

  public verifyUrlParameters(queryString: any) {
    this.config = this._validateConfigIntegrity(this.config);
    this._validatePostPaymentIntegrity(queryString);

    const decrypted: string = UtilsCrypto.decryptPrivate(queryString.s, this.config.private_key);

    const testParams = {
      app_id: this.config.app_id,
      app_secret: this.config.app_secret,
      session_id: queryString.session_id,
      status: queryString.status,
      customer_id: queryString.customer_id,
      provider: queryString.provider,
      state: queryString.state,
    };
    const testParamsArr = [];
    for (const key in testParams) {
      if (testParams.hasOwnProperty(key)) {
        testParamsArr.push(key + '=' + testParams[key]);
      }
    }
    const testParamsString = testParamsArr.join('&');
    const localDigest = UtilsCrypto.hashBase64(testParamsString);

    return decrypted === localDigest;
  }

  private _validateConnectConfigIntegrity(connectConfig: any) {
    if (!connectConfig.amount) {
      throw Error('amount not set');
    }
    if (isNaN(connectConfig.amount)) {
      throw Error('amount must be a number');
    }
    if (!(connectConfig.amount >= 1)) {
      throw Error('amount must be greater than 1');
    }
    if (!connectConfig.currency) {
      throw Error('currency not set');
    }
    if (!connectConfig.customer_id && this.config.env === Constants.PRODUCTIONENVIRONMENT) {
      throw Error('customer identifier must be set');
    }
    if (!connectConfig.customer_full_name && this.config.env === Constants.PRODUCTIONENVIRONMENT) {
      throw Error('customer full name must be set');
    }
    if (!connectConfig.customer_email && this.config.env === Constants.PRODUCTIONENVIRONMENT) {
      throw Error('customer email must be set');
    }
    if (!connectConfig.customer_ip && this.config.env === Constants.PRODUCTIONENVIRONMENT) {
      throw Error('customer ip must be set');
    }

    connectConfig.order_id = connectConfig.communication;

    return connectConfig as IConnectConfig;
  }

  private _validatePostPaymentIntegrity(queryString: any) {
    if (typeof queryString !== 'object') {
      throw new Error(`invalid parameter format, the parameter must be an object instead a ${typeof queryString}`);
    }
    if (!queryString.s) {
      this._trowInvalidPostPaymentParameter();
    }
    if (!queryString.status) {
      this._trowInvalidPostPaymentParameter();
    }
    if (!queryString.session_id) {
      this._trowInvalidPostPaymentParameter();
    }
    if (!queryString.customer_id) {
      this._trowInvalidPostPaymentParameter();
    }
    if (!queryString.provider) {
      this._trowInvalidPostPaymentParameter();
    }
  }

  private _trowInvalidPostPaymentParameter() {
    throw Error('missing query string');
  }

  private _buildSignature(payment: any, privateKey: string, algorithm: string): string {
    return UtilsCrypto.signPayload(payment, privateKey, algorithm);
  }

  private _buildPayload(payment: any) {
    const attributes: IAttributes = {
      amount: payment.amount,
      currency: payment.currency,
      communication: `${payment.order_id}`,
      end_to_end_id: payment.end_to_end_id,
    };

    const meta: IMeta = {
      psu_local_id: payment.customer_id,
      psu_name: payment.customer_full_name,
      psu_email: payment.customer_email,
      psu_ip: payment.customer_ip,
    };

    const data: IData = {
      type: 'SEPA',
      attributes: attributes,
    };

    const payload: IPayload = {
      data: data,
      meta: meta,
    };

    return payload;
  }

  private _validateConfigIntegrity(config) {
    if (!config.private_key) {
      throw Error('private_key must be set to use this function');
    }

    return config as IConfig;
  }
}
