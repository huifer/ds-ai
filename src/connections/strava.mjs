// src/connections/strava.mjs
// Strava 连接器 - 运动数据接入

import { ConnectionBase, ConnectionRegistry } from './base.mjs';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const STRAVA_REDIRECT_URI = process.env.STRAVA_REDIRECT_URI || 'http://localhost:3000/auth/strava/callback';

const STRAVA_API = 'https://www.strava.com/api/v3';

class StravaConnection extends ConnectionBase {
  constructor() {
    super({
      id: 'strava',
      name: 'Strava',
      description: '跑步、骑行等运动数据追踪',
      icon: '🚴',
      authUrl: 'https://www.strava.com/oauth/authorize',
      tokenUrl: 'https://www.strava.com/oauth/token',
      scopes: ['read', 'activity:read_all'],
    });
  }
  
  // ============ OAuth 流程 ============
  
  async getAuthUrl() {
    const state = this._generateState();
    const params = new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      redirect_uri: STRAVA_REDIRECT_URI,
      response_type: 'code',
      scope: this.scopes.join(','),
      state: state,
    });
    
    return {
      authUrl: `https://www.strava.com/oauth/authorize?${params}`,
      state: state,
    };
  }
  
  _generateState() {
    return Math.random().toString(36).substring(2, 15);
  }
  
  async exchangeCode(code) {
    const params = new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
    });
    
    const response = await fetch(`${STRAVA_API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Strava OAuth failed: ${err}`);
    }
    
    const data = await response.json();
    
    // 保存 credentials
    const credentials = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at * 1000, // 转为毫秒
      athlete_id: data.athlete?.id,
      athlete_name: data.athlete?.firstname + ' ' + data.athlete?.lastname,
    };
    
    await this.saveCredentials(credentials);
    return credentials;
  }
  
  async refreshToken() {
    if (!this.credentials?.refresh_token) {
      throw new Error('No refresh token available');
    }
    
    const params = new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: this.credentials.refresh_token,
    });
    
    const response = await fetch(`${STRAVA_API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }
    
    const data = await response.json();
    
    const newCredentials = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at * 1000,
      athlete_id: this.credentials.athlete_id,
      athlete_name: this.credentials.athlete_name,
    };
    
    await this.saveCredentials(newCredentials);
    return newCredentials;
  }
  
  // ============ API 调用 ============
  
  async _ensureValidToken() {
    if (!this.isConnected()) {
      throw new Error('Strava not connected');
    }
    
    if (this.isTokenExpired()) {
      console.log('Token expired, refreshing...');
      await this.refreshToken();
    }
    
    return this.credentials.access_token;
  }
  
  async _api(endpoint, options = {}) {
    const token = await this._ensureValidToken();
    
    const response = await fetch(`${STRAVA_API}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Strava API error ${response.status}: ${err}`);
    }
    
    return response.json();
  }
  
  // ============ 查询方法 ============
  
  /**
   * 获取运动员信息
   */
  async getAthlete() {
    return this._api('/athlete');
  }
  
  /**
   * 获取统计数据
   * @param {number} athleteId - 运动员 ID
   */
  async getStats(athleteId) {
    const id = athleteId || this.credentials?.athlete_id;
    return this._api(`/athletes/${id}/stats`);
  }
  
  /**
   * 获取最近活动
   * @param {object} params - { page: 1, per_page: 10 }
   */
  async getActivities(params = {}) {
    const { page = 1, per_page = 10 } = params;
    return this._api(`/athlete/activities?page=${page}&per_page=${per_page}`);
  }
  
  /**
   * 获取单个活动详情
   * @param {string} activityId
   */
  async getActivity(activityId) {
    return this._api(`/activities/${activityId}`);
  }
  
  /**
   * 获取活动分段（圈）
   * @param {string} activityId
   */
  async getActivityLaps(activityId) {
    return this._api(`/activities/${activityId}/laps`);
  }
  
  /**
   * 获取活动流（详细数据）
   * @param {string} activityId
   * @param {string[]} types - ['time', 'distance', 'latlng', 'heartrate', 'altitude', 'velocity_smooth']
   */
  async getActivityStreams(activityId, types = ['time', 'distance', 'heartrate', 'altitude']) {
    return this._api(
      `/activities/${activityId}/streams?keys=${types.join(',')}&key_by_type=true`
    );
  }
  
  // ============ 统一查询接口 ============
  
  async query(params = {}) {
    const { type = 'recent', range = 'week', limit = 10 } = params;
    
    // 确保 token 有效
    await this._ensureValidToken();
    
    switch (type) {
      case 'athlete':
        return this.getAthlete();
        
      case 'stats':
        return this.getStats();
        
      case 'recent':
        // 最近 N 次活动
        const activities = await this.getActivities({ per_page: limit });
        return this._formatActivities(activities);
        
      case 'weekly':
        // 本周统计
        const weekStats = await this.getStats();
        return this._formatWeeklyStats(weekStats);
        
      case 'monthly':
        // 本月统计
        const monthStats = await this.getStats();
        return this._formatMonthlyStats(monthStats);
        
      case 'activity':
        // 单个活动详情
        return this.getActivity(params.activityId);
        
      default:
        throw new Error(`Unknown query type: ${type}`);
    }
  }
  
  // ============ 状态检查 ============
  
  async getStatus() {
    if (!this.isConnected()) {
      return { connected: false };
    }
    
    try {
      const athlete = await this.getAthlete();
      return {
        connected: true,
        info: {
          name: `${athlete.firstname} ${athlete.lastname}`,
          city: athlete.city,
          country: athlete.country,
          profile: athlete.profile,
        },
      };
    } catch (e) {
      return { connected: false, error: e.message };
    }
  }
  
  // ============ 格式化输出 ============
  
  _formatActivities(activities) {
    return activities.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      sport_type: a.sport_type,
      date: a.start_date,
      distance_km: Math.round(a.distance / 1000 * 100) / 100,
      moving_time: this._formatDuration(a.moving_time),
      elapsed_time: this._formatDuration(a.elapsed_time),
      average_speed: a.average_speed ? (a.average_speed * 3.6).toFixed(2) + ' km/h' : null,
      average_heartrate: a.average_heartrate ? Math.round(a.average_heartrate) + ' bpm' : null,
      total_elevation: a.total_elevation_gain + ' m',
    }));
  }
  
  _formatWeeklyStats(stats) {
    return {
      period: 'week',
      recent_ride: {
        count: stats.recent_ride_totals?.count || 0,
        distance_km: stats.recent_ride_totals?.distance ? 
          Math.round(stats.recent_ride_totals.distance / 1000 * 100) / 100 : 0,
        moving_time: this._formatDuration(stats.recent_ride_totals?.moving_time || 0),
      },
      recent_run: {
        count: stats.recent_run_totals?.count || 0,
        distance_km: stats.recent_run_totals?.distance ? 
          Math.round(stats.recent_run_totals.distance / 1000 * 100) / 100 : 0,
        moving_time: this._formatDuration(stats.recent_run_totals?.moving_time || 0),
        elevation_gain: stats.recent_run_totals?.elevation_gain || 0,
      },
      recent_swim: {
        count: stats.recent_swim_totals?.count || 0,
        distance_m: stats.recent_swim_totals?.distance || 0,
        moving_time: this._formatDuration(stats.recent_swim_totals?.moving_time || 0),
      },
    };
  }
  
  _formatMonthlyStats(stats) {
    return {
      period: 'month',
      ytd_ride: {
        count: stats.ytd_ride_totals?.count || 0,
        distance_km: stats.ytd_ride_totals?.distance ? 
          Math.round(stats.ytd_ride_totals.distance / 1000 * 100) / 100 : 0,
        moving_time: this._formatDuration(stats.ytd_ride_totals?.moving_time || 0),
      },
      ytd_run: {
        count: stats.ytd_run_totals?.count || 0,
        distance_km: stats.ytd_run_totals?.distance ? 
          Math.round(stats.ytd_run_totals.distance / 1000 * 100) / 100 : 0,
        moving_time: this._formatDuration(stats.ytd_run_totals?.moving_time || 0),
        elevation_gain: stats.ytd_run_totals?.elevation_gain || 0,
      },
    };
  }
  
  _formatDuration(seconds) {
    if (!seconds) return '0h 0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
}

// 注册
const strava = new StravaConnection();
ConnectionRegistry.register(strava);

export default strava;
export { StravaConnection };
