import axios from 'axios';
import { Constants } from '../utils/Constants';
import { BaseUrls } from '../utils/URLBuilders/BaseUrls';

export const getInstance = (env: string, clientToken: string) => {
  return axios.create({
    headers: {
      Accept: 'application/json',
      'User-Agent': `Fintecture NodeJS SDK v ${Constants.FINTECTURESDKVERSION}`,
      Authorization: `Basic ${clientToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    baseURL: env === Constants.SANDBOXENVIRONMENT ? BaseUrls.FINTECTUREOAUTHURL_SBX : BaseUrls.FINTECTUREOAUTHURL_PRD,
  });
};
