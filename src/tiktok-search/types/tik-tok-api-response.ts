export interface RootObject {
  keyword: string;
  results: Results;
  success: boolean;
}

export interface Results {
  code: number;
  data: Data;
  msg: string;
  request_id: string;
}

export interface Data {
  materials: Material[];
  pagination: Pagination;
}

export interface Material {
  ad_title: string;
  brand_name: string;
  cost: number;
  ctr: number;
  favorite: boolean;
  id: string;
  industry_key: string;
  is_search: boolean;
  like: number;
  objective_key: string;
  tag?: number;
  video_info: VideoInfo;
}

export interface VideoInfo {
  cover: string;
  duration: number;
  height: number;
  vid: string;
  video_url: VideoURL;
  width: number;
}

export interface VideoURL {
  '1080p'?: string;
  '360p'?: string;
  '480p'?: string;
  '540p'?: string;
  '720p': string;
}

export interface Pagination {
  has_more: boolean;
  page: number;
  size: number;
  total_count: number;
}
